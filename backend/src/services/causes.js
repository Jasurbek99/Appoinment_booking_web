import sql from 'mssql';
import { getPool } from '../db/pool.js';
import { ConflictError, NotFoundError } from '../lib/errors.js';

export async function list() {
  const pool = await getPool();
  const r = await pool
    .request()
    .query('SELECT id, label_ru, label_tk, is_system FROM causes ORDER BY is_system DESC, id');
  return r.recordset.map((row) => ({
    id: row.id,
    label_ru: row.label_ru,
    label_tk: row.label_tk,
    isSystem: !!row.is_system,
  }));
}

export async function create({ id, label_ru, label_tk }) {
  const pool = await getPool();
  const dup = await pool
    .request()
    .input('id', sql.NVarChar(50), id)
    .query('SELECT id FROM causes WHERE id = @id');
  if (dup.recordset.length > 0) throw new ConflictError('id_taken', 'id_taken');

  await pool
    .request()
    .input('id', sql.NVarChar(50), id)
    .input('label_ru', sql.NVarChar(200), label_ru)
    .input('label_tk', sql.NVarChar(200), label_tk)
    .query(`INSERT INTO causes (id, label_ru, label_tk, is_system) VALUES (@id, @label_ru, @label_tk, 0)`);
  return { id, label_ru, label_tk, isSystem: false };
}

export async function update(id, patch) {
  const pool = await getPool();
  const existing = await pool
    .request()
    .input('id', sql.NVarChar(50), id)
    .query('SELECT id, label_ru, label_tk, is_system FROM causes WHERE id = @id');
  if (existing.recordset.length === 0) throw new NotFoundError();

  const sets = [];
  const req = pool.request().input('id', sql.NVarChar(50), id);
  if (patch.label_ru !== undefined) {
    sets.push('label_ru = @label_ru');
    req.input('label_ru', sql.NVarChar(200), patch.label_ru);
  }
  if (patch.label_tk !== undefined) {
    sets.push('label_tk = @label_tk');
    req.input('label_tk', sql.NVarChar(200), patch.label_tk);
  }
  if (sets.length > 0) {
    await req.query(`UPDATE causes SET ${sets.join(', ')} WHERE id = @id`);
  }

  const after = await pool
    .request()
    .input('id', sql.NVarChar(50), id)
    .query('SELECT id, label_ru, label_tk, is_system FROM causes WHERE id = @id');
  const row = after.recordset[0];
  return { id: row.id, label_ru: row.label_ru, label_tk: row.label_tk, isSystem: !!row.is_system };
}

export async function remove(id) {
  const pool = await getPool();
  const existing = await pool
    .request()
    .input('id', sql.NVarChar(50), id)
    .query('SELECT id, is_system FROM causes WHERE id = @id');
  if (existing.recordset.length === 0) throw new NotFoundError();
  if (existing.recordset[0].is_system) throw new ConflictError('system_cause', 'system_cause');

  const refs = await pool
    .request()
    .input('id', sql.NVarChar(50), id)
    .query('SELECT TOP 1 id FROM appointments WHERE cause_id = @id');
  if (refs.recordset.length > 0) throw new ConflictError('cause_referenced', 'cause_referenced');

  await pool.request().input('id', sql.NVarChar(50), id).query('DELETE FROM causes WHERE id = @id');
}
