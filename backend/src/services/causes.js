import sql from 'mssql';
import { getPool } from '../db/pool.js';
import { ConflictError, NotFoundError } from '../lib/errors.js';

const VALID_KINDS = new Set(['visit', 'reject', 'reschedule']);

function mapRow(row) {
  return {
    id: row.id,
    label_ru: row.label_ru,
    label_tk: row.label_tk,
    isSystem: !!row.is_system,
    kind: row.kind,
  };
}

export async function list({ kind } = {}) {
  const pool = await getPool();
  const req = pool.request();
  let where = '';
  if (kind) {
    if (!VALID_KINDS.has(kind)) return [];
    req.input('kind', sql.NVarChar(20), kind);
    where = 'WHERE kind = @kind';
  }
  const r = await req.query(
    `SELECT id, label_ru, label_tk, is_system, kind FROM causes ${where} ORDER BY kind, is_system DESC, id`,
  );
  return r.recordset.map(mapRow);
}

export async function getById(id) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('id', sql.NVarChar(50), id)
    .query('SELECT id, label_ru, label_tk, is_system, kind FROM causes WHERE id = @id');
  return r.recordset[0] ? mapRow(r.recordset[0]) : null;
}

export async function create({ id, label_ru, label_tk, kind = 'visit' }) {
  if (!VALID_KINDS.has(kind)) throw new ConflictError('invalid_kind', 'invalid_kind');
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
    .input('kind', sql.NVarChar(20), kind)
    .query(
      `INSERT INTO causes (id, label_ru, label_tk, is_system, kind) VALUES (@id, @label_ru, @label_tk, 0, @kind)`,
    );
  return { id, label_ru, label_tk, isSystem: false, kind };
}

export async function update(id, patch) {
  const pool = await getPool();
  const existing = await pool
    .request()
    .input('id', sql.NVarChar(50), id)
    .query('SELECT id, label_ru, label_tk, is_system, kind FROM causes WHERE id = @id');
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
    .query('SELECT id, label_ru, label_tk, is_system, kind FROM causes WHERE id = @id');
  return mapRow(after.recordset[0]);
}

export async function remove(id) {
  const pool = await getPool();
  const existing = await pool
    .request()
    .input('id', sql.NVarChar(50), id)
    .query('SELECT id, is_system, kind FROM causes WHERE id = @id');
  if (existing.recordset.length === 0) throw new NotFoundError();
  if (existing.recordset[0].is_system) throw new ConflictError('system_cause', 'system_cause');

  const kind = existing.recordset[0].kind;
  if (kind === 'visit') {
    const refs = await pool
      .request()
      .input('id', sql.NVarChar(50), id)
      .query('SELECT TOP 1 id FROM appointments WHERE cause_id = @id');
    if (refs.recordset.length > 0) throw new ConflictError('cause_referenced', 'cause_referenced');
  } else if (kind === 'reject') {
    const refs = await pool
      .request()
      .input('id', sql.NVarChar(50), id)
      .query('SELECT TOP 1 id FROM appointments WHERE rejection_cause_id = @id');
    if (refs.recordset.length > 0) throw new ConflictError('cause_referenced', 'cause_referenced');
  }
  // 'reschedule' causes are referenced only inside appointment_history.note JSON;
  // we don't block deletion on that since history is append-only and the label
  // text is preserved at the point of recording (see write service).

  await pool.request().input('id', sql.NVarChar(50), id).query('DELETE FROM causes WHERE id = @id');
}
