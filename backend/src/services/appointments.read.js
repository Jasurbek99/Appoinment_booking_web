// The ONLY place that builds appointment SELECTs, including the carryover
// WHERE clause (SPEC.md §8). Add new query modes here, never inline elsewhere.

import sql from 'mssql';
import { getPool } from '../db/pool.js';
import { toAppointmentDTO, toPublicAppointmentDTO } from './appointments.serializer.js';

const APPT_COLUMNS = `
  a.id, a.visitor_type, a.employee_id,
  a.visitor_first_name, a.visitor_last_name, a.visitor_company,
  a.boss_id, a.cause_id, a.custom_cause, a.urgent,
  a.visit_date, a.status, a.rejection_reason, a.created_at
`;

const HIST_COLUMNS = `
  h.appointment_id, h.action, h.user_id, h.at, h.note,
  u.display_name, u.role
`;

function buildWhere({ mode, bossId, status, date, lastName }) {
  const clauses = [];
  const inputs = [];

  if (mode === 'today') {
    clauses.push(
      `(a.visit_date = CAST(GETDATE() AS DATE)
        OR (a.visit_date < CAST(GETDATE() AS DATE) AND a.status IN ('approved','invited')))`,
    );
  } else if (mode === 'future') {
    clauses.push(`a.visit_date > CAST(GETDATE() AS DATE)`);
  } else if (mode === 'date') {
    clauses.push(`a.visit_date = @date`);
    inputs.push({ name: 'date', type: sql.Date, value: date });
  } else if (mode === 'public') {
    clauses.push(
      `a.visitor_last_name = @lastName AND a.visit_date >= DATEADD(day, -30, CAST(GETDATE() AS DATE))`,
    );
    inputs.push({ name: 'lastName', type: sql.NVarChar(100), value: lastName });
  } else if (mode === 'all') {
    // no date filter
  }

  if (bossId) {
    clauses.push(`a.boss_id = @bossId`);
    inputs.push({ name: 'bossId', type: sql.NVarChar(20), value: bossId });
  }
  if (status) {
    clauses.push(`a.status = @status`);
    inputs.push({ name: 'status', type: sql.NVarChar(20), value: status });
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    inputs,
  };
}

// Sorting per SPEC.md §8: urgent-pending first, then created_at ASC.
const ORDER_BY = `
  CASE WHEN a.urgent = 1 AND a.status = 'pending' THEN 0 ELSE 1 END,
  a.created_at ASC
`;

export async function listAppointments(opts = {}, { employeeLookup = null, serializer = toAppointmentDTO, limit = null } = {}) {
  const pool = await getPool();
  const { where, inputs } = buildWhere(opts);

  const apptReq = pool.request();
  for (const i of inputs) apptReq.input(i.name, i.type, i.value);
  const top = limit ? `TOP ${Number(limit)}` : '';
  const apptResult = await apptReq.query(`
    SELECT ${top} ${APPT_COLUMNS}
    FROM appointments a
    ${where}
    ORDER BY ${ORDER_BY}
  `);

  const rows = apptResult.recordset;
  if (rows.length === 0) return [];

  // Fetch all history rows for the returned appointments in one query.
  const ids = rows.map((r) => r.id);
  const histReq = pool.request();
  ids.forEach((id, i) => histReq.input(`id${i}`, sql.Int, id));
  const idParams = ids.map((_, i) => `@id${i}`).join(',');
  const histResult = await histReq.query(`
    SELECT ${HIST_COLUMNS}
    FROM appointment_history h
    LEFT JOIN users u ON u.id = h.user_id
    WHERE h.appointment_id IN (${idParams})
    ORDER BY h.appointment_id, h.at ASC
  `);

  const historyByAppt = new Map();
  for (const h of histResult.recordset) {
    if (!historyByAppt.has(h.appointment_id)) historyByAppt.set(h.appointment_id, []);
    historyByAppt.get(h.appointment_id).push(h);
  }

  return rows.map((r) => serializer(r, historyByAppt.get(r.id) || [], employeeLookup));
}

// Convenience wrapper for the public worker search.
export async function listPublicByLastName(lastName, opts = {}) {
  return listAppointments(
    { mode: 'public', lastName },
    { ...opts, serializer: toPublicAppointmentDTO, limit: 20 },
  );
}

export async function getAppointmentById(id, { employeeLookup = null } = {}) {
  const list = await listAppointments({ mode: 'all', _byId: id }, { employeeLookup });
  // Tiny inefficiency for v1: filter after fetch. Replace with a direct query if profiling shows it.
  return list.find((a) => a.id === id) || null;
}

export async function getAppointmentRow(id) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('id', sql.Int, id)
    .query(`SELECT ${APPT_COLUMNS} FROM appointments a WHERE a.id = @id`);
  return r.recordset[0] || null;
}

// Compose a single full DTO for a freshly written appointment, used by write paths
// after they've committed their transaction.
export async function loadFullDTO(id, { employeeLookup = null } = {}) {
  const pool = await getPool();
  const apptRes = await pool
    .request()
    .input('id', sql.Int, id)
    .query(`SELECT ${APPT_COLUMNS} FROM appointments a WHERE a.id = @id`);
  const row = apptRes.recordset[0];
  if (!row) return null;

  const histRes = await pool.request().input('id', sql.Int, id).query(`
      SELECT ${HIST_COLUMNS}
      FROM appointment_history h
      LEFT JOIN users u ON u.id = h.user_id
      WHERE h.appointment_id = @id
      ORDER BY h.at ASC
    `);
  return toAppointmentDTO(row, histRes.recordset, employeeLookup);
}
