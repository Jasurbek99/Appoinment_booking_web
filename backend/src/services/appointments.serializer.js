// Two serializers, intentionally separate. The public DTO must NEVER carry
// internal user IDs (SPEC.md §12). Don't add a flag — keep the surfaces split.

import { roleNameById } from '../lib/roles.js';

function bossIdFromRow(row) {
  return row.boss_id;
}

function visitorParts(row) {
  return {
    firstName: row.visitor_first_name,
    lastName: row.visitor_last_name,
    company: row.visitor_company,
    phone: row.visitor_phone || null,
  };
}

function buildEmployee(row, employeeLookup) {
  if (row.visitor_type !== 'employee' || row.employee_id == null) return null;
  if (!employeeLookup) return null;
  const e = employeeLookup(row.employee_id);
  return e || null;
}

// historyRows: array of { action, user_id, at, note, display_name?, role? }
// (display_name+role joined in the read query so we can resolve soft-deleted users).
export function toAppointmentDTO(row, historyRows, employeeLookup = null) {
  const employee = buildEmployee(row, employeeLookup);
  const visitor =
    row.visitor_type === 'employee'
      ? employee
        ? null
        : visitorParts(row)
      : visitorParts(row);

  return {
    id: row.id,
    visitorType: row.visitor_type,
    employee,
    visitor,
    bossId: bossIdFromRow(row),
    causeId: row.cause_id,
    customCause: row.custom_cause,
    urgent: !!row.urgent,
    date: formatDate(row.visit_date),
    status: row.status,
    rejectionReason: row.rejection_reason,
    rejectionCauseId: row.rejection_cause_id || null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    history: (historyRows || []).map((h) => ({
      action: h.action,
      user: {
        id: h.user_id,
        displayName: h.display_name || h.user_id,
        role: h.role,
        roleName: h.role ? roleNameById(h.role) : null,
      },
      at: h.at instanceof Date ? h.at.toISOString() : h.at,
      note: h.note || null,
    })),
  };
}

// Public version. No user IDs, no phone (PII). Only visible details a worker needs to see.
export function toPublicAppointmentDTO(row, historyRows, employeeLookup = null) {
  const employee = buildEmployee(row, employeeLookup);
  const rawVisitor =
    row.visitor_type === 'employee'
      ? employee
        ? null
        : visitorParts(row)
      : visitorParts(row);
  const visitor = rawVisitor
    ? { firstName: rawVisitor.firstName, lastName: rawVisitor.lastName, company: rawVisitor.company }
    : null;

  return {
    id: row.id,
    bossId: row.boss_id,
    causeId: row.cause_id,
    urgent: !!row.urgent,
    date: formatDate(row.visit_date),
    status: row.status,
    visitor,
    employee: employee
      ? { firstName: employee.firstName, lastName: employee.lastName, company: employee.company }
      : null,
    history: (historyRows || []).map((h) => ({
      action: h.action,
      actor: {
        displayName: h.display_name || null,
        role: h.role || null,
      },
      at: h.at instanceof Date ? h.at.toISOString() : h.at,
    })),
  };
}

function formatDate(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  // mssql DATE returns a JS Date at UTC midnight; format as YYYY-MM-DD without TZ shift.
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
