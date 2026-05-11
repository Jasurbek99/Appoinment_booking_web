import { Router } from 'express';
import { getPool } from '../db/pool.js';
import { requireAuth, requireBoss } from '../middleware/auth.js';
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
