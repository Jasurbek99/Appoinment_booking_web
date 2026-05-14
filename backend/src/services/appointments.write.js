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
import { getById as getCauseById } from './causes.js';
import {
  ConflictError,
  DuplicateError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../lib/errors.js';

const ALLOWED_TRANSITIONS = {
  pending: { approve: 'approved', reject: 'rejected', reschedule: 'pending' },
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

async function assertCauseKind(causeId, expectedKind) {
  const cause = await getCauseById(causeId);
  if (!cause) {
    throw new ValidationError({ causeId: [`unknown cause '${causeId}'`] });
  }
  if (cause.kind !== expectedKind) {
    throw new ValidationError({
      causeId: [`cause '${causeId}' is of kind '${cause.kind}', expected '${expectedKind}'`],
    });
  }
  return cause;
}

export async function create({ input, actor, force = false, employeeLookup = null }) {
  const visitDate = clampDate(input.date);

  // The submitted causeId must be a visit-cause — never a reject/reschedule one.
  await assertCauseKind(input.causeId, 'visit');

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
      .input('visitor_phone', sql.NVarChar(40), input.visitorType === 'foreign' ? null : input.visitor?.phone ?? null)
      .input('boss_id', sql.NVarChar(20), input.bossId)
      .input('cause_id', sql.NVarChar(50), input.causeId)
      .input('custom_cause', sql.NVarChar(500), input.causeId === 'other' ? input.customCause ?? null : null)
      .input('urgent', sql.Bit, input.urgent ? 1 : 0)
      .input('visit_date', sql.Date, visitDate)
      .input('status', sql.NVarChar(20), 'pending');

    const result = await apptReq.query(`
      INSERT INTO appointments
        (visitor_type, employee_id, visitor_first_name, visitor_last_name, visitor_company, visitor_phone,
         boss_id, cause_id, custom_cause, urgent, visit_date, status)
      OUTPUT INSERTED.id
      VALUES
        (@visitor_type, @employee_id, @visitor_first_name, @visitor_last_name, @visitor_company, @visitor_phone,
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

export async function transition({ id, action, actor, note, causeId, newDate, employeeLookup = null }) {
  // Kind checks happen BEFORE the transaction so a bad input fails fast.
  if (action === 'reject' && causeId) {
    await assertCauseKind(causeId, 'reject');
  }
  if (action === 'reschedule') {
    if (!newDate) throw new ValidationError({ date: ['required for reschedule'] });
    if (newDate < todayLocalISO()) throw new ValidationError({ date: ['cannot be in the past'] });
    if (causeId) await assertCauseKind(causeId, 'reschedule');
  }

  await withTransaction(async (tx) => {
    // Lock the row to serialize concurrent transitions.
    const cur = await new sql.Request(tx)
      .input('id', sql.Int, id)
      .query(`SELECT id, status, boss_id, visit_date FROM appointments WITH (UPDLOCK, ROWLOCK) WHERE id = @id`);
    if (cur.recordset.length === 0) throw new NotFoundError();
    const row = cur.recordset[0];

    // Authorization: approve/reject/invite/reschedule require own-boss; complete is broader.
    if (action === 'approve' || action === 'reject' || action === 'invite' || action === 'reschedule') {
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
      updReq
        .input('reason', sql.NVarChar(500), note ?? null)
        .input('cause_id', sql.NVarChar(50), causeId ?? null);
      await updReq.query(
        `UPDATE appointments
            SET status = @next, rejection_reason = @reason, rejection_cause_id = @cause_id
          WHERE id = @id`,
      );
    } else if (action === 'reschedule') {
      updReq.input('visit_date', sql.Date, newDate);
      await updReq.query(`UPDATE appointments SET visit_date = @visit_date WHERE id = @id`);
    } else {
      await updReq.query(`UPDATE appointments SET status = @next WHERE id = @id`);
    }

    // history.note: reject keeps free-text reason; reschedule packs metadata
    // as JSON (oldDate/newDate/causeId/reason) so the full record survives
    // even if a cause is deleted later.
    let historyNote = null;
    if (action === 'reject') {
      historyNote = note ?? null;
    } else if (action === 'reschedule') {
      const oldDate = row.visit_date instanceof Date
        ? row.visit_date.toISOString().slice(0, 10)
        : String(row.visit_date).slice(0, 10);
      historyNote = JSON.stringify({
        oldDate,
        newDate,
        causeId: causeId ?? null,
        reason: note ?? null,
      });
    }

    await new sql.Request(tx)
      .input('id', sql.Int, id)
      .input('user_id', sql.NVarChar(50), actor.id)
      .input('action', sql.NVarChar(20), action)
      .input('note', sql.NVarChar(500), historyNote)
      .query(
        `INSERT INTO appointment_history (appointment_id, action, user_id, note) VALUES (@id, @action, @user_id, @note)`,
      );
  });

  // Re-load AFTER commit (also acts as a fresh read for the response).
  return loadFullDTO(id, { employeeLookup });
}

// Boss-only "clear my calendar" — shift every approved/invited appointment
// dated today or later by N days. One transaction; one history row per moved
// appointment with the same JSON note shape as single-item reschedule plus a
// bulk:true marker so the journal can group them later.
export async function bulkReschedule({
  bossId,
  shiftDays,
  causeId,
  reason,
  actor,
  employeeLookup = null,
}) {
  if (!BOSS_ROLES.has(bossId)) throw new ValidationError({ bossId: ['unknown boss'] });
  if (actor.role !== bossId) throw new ForbiddenError();
  if (causeId) await assertCauseKind(causeId, 'reschedule');

  const movedIds = await withTransaction(async (tx) => {
    // Pending is included too — if the boss is away, no one can decide on
    // those, and the visitor would still arrive on the original date.
    // Carryover (past-dated) is also included; the UPDATE clamps any
    // past visit_date to today before applying the shift so no moved row
    // lands in the past.
    const sel = await new sql.Request(tx)
      .input('boss_id', sql.NVarChar(20), bossId)
      .query(`
        SELECT id, visit_date FROM appointments WITH (UPDLOCK, ROWLOCK)
        WHERE boss_id = @boss_id
          AND status IN ('pending','approved','invited')
        ORDER BY id
      `);

    const ids = [];
    for (const row of sel.recordset) {
      const oldDate = row.visit_date instanceof Date
        ? row.visit_date.toISOString().slice(0, 10)
        : String(row.visit_date).slice(0, 10);

      const upd = await new sql.Request(tx)
        .input('id', sql.Int, row.id)
        .input('shift', sql.Int, shiftDays)
        .query(`
          UPDATE appointments
             SET visit_date = DATEADD(
               day, @shift,
               CASE WHEN visit_date < CAST(GETDATE() AS DATE)
                    THEN CAST(GETDATE() AS DATE)
                    ELSE visit_date END
             )
           WHERE id = @id;
          SELECT CONVERT(varchar(10), visit_date, 23) AS new_date
            FROM appointments WHERE id = @id;
        `);
      const newDate = upd.recordset[0].new_date;

      const note = JSON.stringify({
        oldDate,
        newDate,
        causeId: causeId ?? null,
        reason: reason ?? null,
        bulk: true,
      });

      await new sql.Request(tx)
        .input('id', sql.Int, row.id)
        .input('user_id', sql.NVarChar(50), actor.id)
        .input('note', sql.NVarChar(500), note)
        .query(
          `INSERT INTO appointment_history (appointment_id, action, user_id, note)
           VALUES (@id, 'reschedule', @user_id, @note)`,
        );

      ids.push(row.id);
    }
    return ids;
  });

  const dtos = [];
  for (const id of movedIds) {
    const dto = await loadFullDTO(id, { employeeLookup });
    if (dto) dtos.push(dto);
  }
  return dtos;
}
