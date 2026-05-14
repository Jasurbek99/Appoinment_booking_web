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
  user_id: z.string().max(50).optional(),
  action: z.enum(['create', 'approve', 'reject', 'invite', 'complete', 'reschedule']).optional(),
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
      .input('user_id', sql.NVarChar(50), q.user_id || null)
      .input('action', sql.NVarChar(20), q.action || null)
      .input('boss_scope', sql.NVarChar(20), bossScope)
      .input('limit', sql.Int, HARD_LIMIT)
      .query(`
        SELECT TOP (@limit)
          h.id, h.appointment_id, h.action, h.user_id, h.at, h.note,
          u.display_name AS user_display_name, u.role AS user_role, u.deleted_at AS user_deleted_at,
          a.boss_id, a.visitor_first_name, a.visitor_last_name, a.visitor_company,
          a.visitor_type, a.employee_id, a.cause_id, a.status
        FROM appointment_history h
        LEFT JOIN users u ON u.id = h.user_id
        LEFT JOIN appointments a ON a.id = h.appointment_id
        WHERE h.at >= @from AND h.at < DATEADD(day, 1, @to)
          AND (@user_id IS NULL OR h.user_id = @user_id)
          AND (@action  IS NULL OR h.action  = @action)
          AND (@boss_scope IS NULL OR a.boss_id = @boss_scope)
        ORDER BY h.at DESC
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
    user: {
      id: r.user_id,
      displayName: r.user_display_name,
      role: r.user_role,
      deleted: !!r.user_deleted_at,
    },
    appointment: {
      id: r.appointment_id,
      bossId: r.boss_id,
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
