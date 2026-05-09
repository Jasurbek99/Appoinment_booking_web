import sql from 'mssql';
import { getPool } from '../db/pool.js';

// findByUsername filters out soft-deleted users (login should never authenticate them).
export async function findByUsername(username) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('username', sql.NVarChar(50), username)
    .query(
      `SELECT id, display_name, username, password_hash, role, created_at, deleted_at
       FROM users
       WHERE username = @username AND deleted_at IS NULL`,
    );
  return r.recordset[0] || null;
}

// findById intentionally does NOT filter soft-deleted users so that audit-log
// rendering can resolve the display_name of someone who has since left.
export async function findById(id) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('id', sql.NVarChar(50), id)
    .query(
      `SELECT id, display_name, username, role, created_at, deleted_at
       FROM users
       WHERE id = @id`,
    );
  return r.recordset[0] || null;
}
