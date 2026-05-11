// State-changing operations on appointments. Knows nothing about Socket.io —
// emission is the route layer's job, AFTER this returns.
//
// Every state change writes a matching appointment_history row in the SAME
// transaction. The audit log is the product (SPEC.md §4): it must never get
// out of sync with the appointment row.

import sql from 'mssql';
import { withTransaction } from '../db/tx.js';
import { getPool } from '../db/pool.js';
import { loadFullDTO } from './appointments.read.js';
import {
  ConflictError,
  DuplicateError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../lib/errors.js';

const ALLOWED_TRANSITIONS = {
  pending: { approve: 'approved', reject: 'rejected' },
  approved: { invite: 'invited', complete: 'completed' },
  invited: { complete: 'completed' },
  rejected: {}, // terminal
  completed: {}, // terminal
};

const BOSS_ROLES = new Set(['boss1', 'boss2', 'boss3']);
const STAFF_ROLES = new Set(['secretary', 'assistant1', 'assistant2', 'assistant3']);

function todayLocalISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function clampDate(input) {
  const t = todayLocalISO();
  return input < t ? t : input;
}

export async function create({ input, actor, force = false, employeeLookup = null }) {
  const visitDate = clampDate(input.date);

  // Duplicate detection per SPEC.md §12
  if (!force) {
    const pool = await getPool();
    const dupReq = pool
      .request()
      .input('date', sql.Date, visitDate)
      .input('boss_id', sql.NVarChar(20), input.bossId)
      .input('visitor_type', sql.NVarChar(20), input.visitorType);

    let dupQ;
    if (input.visitorType === 'employee' && input.employeeId) {
      dupReq.input('employee_id', sql.Int, input.employeeId);
      dupQ = `
        SELECT TOP 1 id, status FROM appointments
        WHERE visit_date = @date AND boss_id = @boss_id
          AND status IN ('pending','approved','invited')
          AND visitor_type = 'employee' AND employee_id = @employee_id
      `;
    } else if (input.visitor?.firstName && input.visitor?.lastName) {
      dupReq.input('first', sql.NVarChar(100), input.visitor.firstName);
      dupReq.input('last', sql.NVarChar(100), input.visitor.lastName);
      dupQ = `
        SELECT TOP 1 id, status FROM appointments
        WHERE visit_date = @date AND boss_id = @boss_id
          AND status IN ('pending','approved','invited')
          AND visitor_type = @visitor_type
          AND visitor_first_name = @first AND visitor_last_name = @last
      `;
    } else {
      dupQ = null;
    }

    if (dupQ) {
      const r = await dupReq.query(dupQ);
      if (r.recordset.length > 0) {
        const e = r.recordset[0];
        throw new DuplicateError({ id: e.id, status: e.status });
      }
    }
  }

  const newId = await withTransaction(async (tx) => {
    const apptReq = new sql.Request(tx);
    apptReq
      .input('visitor_type', sql.NVarChar(20), input.visitorType)
      .input('employee_id', sql.Int, input.visitorType === 'employee' ? input.employeeId ?? null : null)
      .input('visitor_first_name', sql.NVarChar(100), input.visitor?.firstName ?? null)
      .input('visitor_last_name', sql.NVarChar(100), input.visitor?.lastName ?? null)
      .input('visitor_company', sql.NVarChar(200), input.visitor?.company ?? null)
      .input('boss_id', sql.NVarChar(20), input.bossId)
      .input('cause_id', sql.NVarChar(50), input.causeId)
      .input('custom_cause', sql.NVarChar(500), input.causeId === 'other' ? input.customCause ?? null : null)
      .input('urgent', sql.Bit, input.urgent ? 1 : 0)
      .input('visit_date', sql.Date, visitDate)
      .input('status', sql.NVarChar(20), 'pending');

    const result = await apptReq.query(`
      INSERT INTO appointments
        (visitor_type, employee_id, visitor_first_name, visitor_last_name, visitor_company,
         boss_id, cause_id, custom_cause, urgent, visit_date, status)
      OUTPUT INSERTED.id
      VALUES
        (@visitor_type, @employee_id, @visitor_first_name, @visitor_last_name, @visitor_company,
         @boss_id, @cause_id, @custom_cause, @urgent, @visit_date, @status)
    `);
    const id = result.recordset[0].id;

    await new sql.Request(tx)
      .input('id', sql.Int, id)
      .input('user_id', sql.NVarChar(50), actor.id)
      .query(
        `INSERT INTO appointment_history (appointment_id, action, user_id) VALUES (@id, 'create', @user_id)`,
      );

    return id;
  });

  return loadFullDTO(newId, { employeeLookup });
}

export async function transition({ id, action, actor, note, employeeLookup = null }) {
  await withTransaction(async (tx) => {
    // Lock the row to serialize concurrent transitions.
    const cur = await new sql.Request(tx)
      .input('id', sql.Int, id)
      .query(`SELECT id, status, boss_id FROM appointments WITH (UPDLOCK, ROWLOCK) WHERE id = @id`);
    if (cur.recordset.length === 0) throw new NotFoundError();
    const row = cur.recordset[0];

    // Authorization: approve/reject/invite require own-boss; complete is broader.
    if (action === 'approve' || action === 'reject' || action === 'invite') {
      if (!BOSS_ROLES.has(actor.role)) throw new ForbiddenError();
      if (actor.role !== row.boss_id) throw new ForbiddenError();
    } else if (action === 'complete') {
      const isOwnBoss = BOSS_ROLES.has(actor.role) && actor.role === row.boss_id;
      const isStaff = STAFF_ROLES.has(actor.role);
      if (!isOwnBoss && !isStaff) throw new ForbiddenError();
    } else {
      throw new ValidationError({ action: ['unknown action'] });
    }

    const next = ALLOWED_TRANSITIONS[row.status]?.[action];
    if (!next) {
      throw new ConflictError(
        `cannot ${action} from ${row.status}`,
        'invalid_transition',
        { from: row.status, action },
      );
    }

    const updReq = new sql.Request(tx).input('id', sql.Int, id).input('next', sql.NVarChar(20), next);
    if (action === 'reject') {
      updReq.input('reason', sql.NVarChar(500), note ?? null);
      await updReq.query(`UPDATE appointments SET status = @next, rejection_reason = @reason WHERE id = @id`);
    } else {
      await updReq.query(`UPDATE appointments SET status = @next WHERE id = @id`);
    }

    await new sql.Request(tx)
      .input('id', sql.Int, id)
      .input('user_id', sql.NVarChar(50), actor.id)
      .input('action', sql.NVarChar(20), action)
      .input('note', sql.NVarChar(500), action === 'reject' ? note ?? null : null)
      .query(
        `INSERT INTO appointment_history (appointment_id, action, user_id, note) VALUES (@id, @action, @user_id, @note)`,
      );
  });

  // Re-load AFTER commit (also acts as a fresh read for the response).
  return loadFullDTO(id, { employeeLookup });
}
