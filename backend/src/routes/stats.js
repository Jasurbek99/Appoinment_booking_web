import { Router } from 'express';
import { z } from 'zod';
import { getPool } from '../db/pool.js';
import { requireAuth, requireBoss, BOSS_ROLES, STAFF_ROLES } from '../middleware/auth.js';
import { ValidationError, ForbiddenError } from '../lib/errors.js';
import sql from 'mssql';

export const statsRouter = Router();

statsRouter.get('/boss', requireAuth, requireBoss, async (req, res, next) => {
  try {
    const pool = await getPool();
    const r = await pool
      .request()
      .input('boss', sql.NVarChar(20), req.user.role)
      .query(`
        SELECT
          SUM(CASE WHEN visit_date = CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) AS total,
          SUM(CASE WHEN visit_date = CAST(GETDATE() AS DATE) AND status = 'approved'  THEN 1 ELSE 0 END) AS approved,
          SUM(CASE WHEN visit_date = CAST(GETDATE() AS DATE) AND status = 'rejected'  THEN 1 ELSE 0 END) AS rejected,
          SUM(CASE WHEN visit_date = CAST(GETDATE() AS DATE) AND status = 'completed' THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN visit_date = CAST(GETDATE() AS DATE) AND urgent = 1 THEN 1 ELSE 0 END) AS urgent
        FROM appointments
        WHERE boss_id = @boss
          AND deleted_at IS NULL
      `);
    const row = r.recordset[0] || {};
    res.json({
      total: Number(row.total || 0),
      approved: Number(row.approved || 0),
      rejected: Number(row.rejected || 0),
      completed: Number(row.completed || 0),
      urgent: Number(row.urgent || 0),
    });
  } catch (err) {
    next(err);
  }
});

const visitorsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  boss_id: z.enum(['boss1', 'boss2', 'boss3']).optional(),
  visitor_type: z.enum(['employee', 'guest', 'foreign']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// Top frequent visitors. Bosses see only their own; staff sees all, optionally
// filtered by ?boss_id. Groups employees by employee_id, non-employees by a
// normalized lastName|firstName|company tuple. Excludes rejected appointments
// (never actually visited).
statsRouter.get('/visitors', requireAuth, async (req, res, next) => {
  try {
    const isStaff = STAFF_ROLES.has(req.user.role);
    const isBoss = BOSS_ROLES.has(req.user.role);
    if (!isStaff && !isBoss) throw new ForbiddenError();

    const parse = visitorsQuerySchema.safeParse(req.query);
    if (!parse.success) throw new ValidationError(parse.error.flatten().fieldErrors);
    const q = parse.data;

    // Bosses force-scope to their own boss_id; any forged ?boss_id is ignored.
    const bossScope = isBoss ? req.user.role : (q.boss_id || null);
    const from = q.from || daysAgoISO(90);
    const to = q.to || todayISO();
    const limit = q.limit || 20;

    const pool = await getPool();
    const r = await pool
      .request()
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
      .input('boss_scope', sql.NVarChar(20), bossScope)
      .input('visitor_type', sql.NVarChar(20), q.visitor_type || null)
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          CASE
            WHEN visitor_type = 'employee' AND employee_id IS NOT NULL
              THEN N'emp:' + CAST(employee_id AS NVARCHAR(20))
            ELSE N'name:' + LOWER(ISNULL(visitor_last_name, N''))
                 + N'|' + LOWER(ISNULL(visitor_first_name, N''))
                 + N'|' + LOWER(ISNULL(visitor_company, N''))
          END AS grp_key,
          MIN(visitor_type)       AS visitor_type,
          MAX(employee_id)        AS employee_id,
          MAX(visitor_first_name) AS first_name,
          MAX(visitor_last_name)  AS last_name,
          MAX(visitor_company)    AS company,
          COUNT(*)                AS visits,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
          MAX(visit_date)         AS last_visit,
          SUM(CASE WHEN boss_id = 'boss1' THEN 1 ELSE 0 END) AS by_boss1,
          SUM(CASE WHEN boss_id = 'boss2' THEN 1 ELSE 0 END) AS by_boss2,
          SUM(CASE WHEN boss_id = 'boss3' THEN 1 ELSE 0 END) AS by_boss3
        FROM appointments
        WHERE status <> 'rejected'
          AND deleted_at IS NULL
          AND visit_date >= @from
          AND visit_date <= @to
          AND (@boss_scope   IS NULL OR boss_id = @boss_scope)
          AND (@visitor_type IS NULL OR visitor_type = @visitor_type)
        GROUP BY
          CASE
            WHEN visitor_type = 'employee' AND employee_id IS NOT NULL
              THEN N'emp:' + CAST(employee_id AS NVARCHAR(20))
            ELSE N'name:' + LOWER(ISNULL(visitor_last_name, N''))
                 + N'|' + LOWER(ISNULL(visitor_first_name, N''))
                 + N'|' + LOWER(ISNULL(visitor_company, N''))
          END
        ORDER BY visits DESC, MAX(visit_date) DESC
      `);

    res.json({
      from,
      to,
      bossScope,
      rows: r.recordset.map((row) => ({
        key: row.grp_key,
        visitorType: row.visitor_type,
        employeeId: row.employee_id == null ? null : Number(row.employee_id),
        firstName: row.first_name || null,
        lastName: row.last_name || null,
        company: row.company || null,
        visits: Number(row.visits || 0),
        completed: Number(row.completed || 0),
        lastVisit: row.last_visit instanceof Date
          ? row.last_visit.toISOString().slice(0, 10)
          : row.last_visit,
        byBoss: bossScope
          ? null
          : {
              boss1: Number(row.by_boss1 || 0),
              boss2: Number(row.by_boss2 || 0),
              boss3: Number(row.by_boss3 || 0),
            },
      })),
    });
  } catch (err) {
    next(err);
  }
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
