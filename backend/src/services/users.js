import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import sql from 'mssql';
import { getPool } from '../db/pool.js';
import { config } from '../config.js';
import { ConflictError, NotFoundError } from '../lib/errors.js';

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

export async function listActive() {
  const pool = await getPool();
  const r = await pool.request().query(
    `SELECT id, display_name, username, role, created_at
     FROM users
     WHERE deleted_at IS NULL
     ORDER BY role, display_name`,
  );
  return r.recordset;
}

export async function create({ display_name, username, password, role }) {
  const pool = await getPool();

  const dup = await pool
    .request()
    .input('username', sql.NVarChar(50), username)
    .query('SELECT id FROM users WHERE username = @username AND deleted_at IS NULL');
  if (dup.recordset.length > 0) {
    throw new ConflictError('username_taken', 'username_taken');
  }

  const id = `u_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

  await pool
    .request()
    .input('id', sql.NVarChar(50), id)
    .input('display_name', sql.NVarChar(200), display_name)
    .input('username', sql.NVarChar(50), username)
    .input('password_hash', sql.NVarChar(200), passwordHash)
    .input('role', sql.NVarChar(20), role).query(`
      INSERT INTO users (id, display_name, username, password_hash, role)
      VALUES (@id, @display_name, @username, @password_hash, @role)
    `);

  return { id, display_name, username, role };
}

export async function update(id, patch) {
  const pool = await getPool();

  const existing = await findById(id);
  if (!existing || existing.deleted_at) throw new NotFoundError();

  if (patch.username && patch.username !== existing.username) {
    const dup = await pool
      .request()
      .input('username', sql.NVarChar(50), patch.username)
      .input('id', sql.NVarChar(50), id)
      .query(
        'SELECT id FROM users WHERE username = @username AND deleted_at IS NULL AND id <> @id',
      );
    if (dup.recordset.length > 0) {
      throw new ConflictError('username_taken', 'username_taken');
    }
  }

  const sets = [];
  const req = pool.request().input('id', sql.NVarChar(50), id);

  if (patch.display_name !== undefined) {
    sets.push('display_name = @display_name');
    req.input('display_name', sql.NVarChar(200), patch.display_name);
  }
  if (patch.username !== undefined) {
    sets.push('username = @username');
    req.input('username', sql.NVarChar(50), patch.username);
  }
  if (patch.role !== undefined) {
    sets.push('role = @role');
    req.input('role', sql.NVarChar(20), patch.role);
  }
  if (patch.password !== undefined) {
    const passwordHash = await bcrypt.hash(patch.password, config.bcryptRounds);
    sets.push('password_hash = @password_hash');
    req.input('password_hash', sql.NVarChar(200), passwordHash);
  }

  if (sets.length === 0) {
    return { id: existing.id, display_name: existing.display_name, username: existing.username, role: existing.role };
  }

  await req.query(`UPDATE users SET ${sets.join(', ')} WHERE id = @id`);
  const after = await findById(id);
  return {
    id: after.id,
    display_name: after.display_name,
    username: after.username,
    role: after.role,
  };
}

export async function softDelete(id) {
  const pool = await getPool();
  const existing = await findById(id);
  if (!existing || existing.deleted_at) throw new NotFoundError();

  await pool
    .request()
    .input('id', sql.NVarChar(50), id)
    .query('UPDATE users SET deleted_at = SYSUTCDATETIME() WHERE id = @id');
}
