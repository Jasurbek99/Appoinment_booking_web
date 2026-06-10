import { Router } from 'express';
import { z } from 'zod';
import sql from 'mssql';
import { getPool } from '../db/pool.js';
import { requireAuth, BOSS_ROLES, STAFF_ROLES } from '../middleware/auth.js';
import { ValidationError, ForbiddenError } from '../lib/errors.js';

export const journalRouter = Router();

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  action: z.enum(['create', 'approve', 'reject', 'invite', 'complete', 'reschedule', 'delete']).optional(),
});

const HARD_LIMIT = 500;

journalRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const isStaff = STAFF_ROLES.has(req.user.role);
    const isBoss = BOSS_ROLES.has(req.user.role);
    if (!isStaff && !isBoss) throw new ForbiddenError();

    const parse = querySchema.safeParse(req.query);
    if (!parse.success) throw new ValidationError(parse.error.flatten().fieldErrors);
    const q = parse.data;

    const from = q.from || daysAgoISO(7);
    const to = q.to || daysAheadISO(1);
    // Bosses see only their own appointments' history.
    const bossScope = isBoss ? req.user.role : null;

    const pool = await getPool();
    const r = await pool.request()
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
      .input('action', sql.NVarChar(20), q.action || null)
      .input('boss_scope', sql.NVarChar(20), bossScope)
      .input('limit', sql.Int, HARD_LIMIT)
      .query(`
        SELECT TOP (@limit)
          l.id, l.appointment_id, l.action, l.at, l.note,
          a.boss_id, b.display_name AS boss_name,
          a.visitor_first_name, a.visitor_last_name, a.visitor_company,
          a.visitor_type, a.employee_id, a.cause_id, a.status
        FROM (
          SELECT h.*,
                 ROW_NUMBER() OVER (PARTITION BY h.appointment_id ORDER BY h.at DESC, h.id DESC) AS rn
          FROM appointment_history h
          WHERE h.at >= @from AND h.at < DATEADD(day, 1, @to)
        ) l
        LEFT JOIN appointments a ON a.id = l.appointment_id
        LEFT JOIN users b ON b.role = a.boss_id AND b.deleted_at IS NULL
        WHERE l.rn = 1
          AND (@action     IS NULL OR l.action  = @action)
          AND (@boss_scope IS NULL OR a.boss_id = @boss_scope)
        ORDER BY l.at DESC
      `);

    res.json(r.recordset.map(toRow));
  } catch (err) {
    next(err);
  }
});

function toRow(r) {
  return {
    id: Number(r.id),
    at: r.at instanceof Date ? r.at.toISOString() : r.at,
    action: r.action,
    appointment: {
      id: r.appointment_id,
      bossId: r.boss_id,
      bossName: r.boss_name || null,
      causeId: r.cause_id,
      status: r.status,
      visitorType: r.visitor_type,
      employeeId: r.employee_id,
      visitorName: r.visitor_first_name && r.visitor_last_name
        ? `${r.visitor_first_name} ${r.visitor_last_name}`
        : null,
      visitorCompany: r.visitor_company,
    },
    note: r.note || null,
  };
}

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function daysAheadISO(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
