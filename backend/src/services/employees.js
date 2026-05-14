// Employee directory backed by the BIONET.dbo.VW_PERSONEL view on the
// VERITRAX MSSQL instance. The view is read-only HR personnel data; this
// service exposes search-by-substring (optionally filtered by firm), a list
// of distinct firms for the picker dropdown, and a sync id lookup that the
// appointment serializer uses to rehydrate employee snapshots.
//
// Contract:
//   search(q, firm?) -> { results: [{id, firstName, lastName, company}], degraded }
//   listFirms()      -> { firms: string[], degraded }
// - Never throws. degraded=true on connection/query failure. The frontend
//   uses degraded to show the manual-entry banner so the create-appointment
//   form still works.
// - Cache results for 5 min in-memory; cache key includes firm so a firm
//   filter doesn't collide with the same q across firms.

import sql from 'mssql';
import { getEmployeesPool } from '../db/employeesPool.js';

const TTL_MS = 5 * 60 * 1000;
const searchCache = new Map(); // `${firm}|${q}` -> { at, value }
let firmsCache = null; // { at, value }

function fromCache(map, key) {
  const hit = map.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    map.delete(key);
    return null;
  }
  return hit.value;
}

function setSearchCache(key, value) {
  searchCache.set(key, { at: Date.now(), value });
  if (searchCache.size > 1000) {
    for (const k of searchCache.keys()) {
      searchCache.delete(k);
      if (searchCache.size <= 800) break;
    }
  }
}

function normalize(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({
      id: Number(row.id),
      firstName: String(row.firstName || '').trim(),
      lastName: String(row.lastName || '').trim(),
      company: String(row.company || '').trim(),
    }))
    .filter((r) => Number.isFinite(r.id) && r.firstName && r.lastName);
}

// When firm is provided, restrict to that firm and search q within name
// fields only (firm-equality already pins the firm). When firm is empty,
// q matches across name and firm columns — the original behaviour.
const SEARCH_SQL = `
  SELECT TOP 20
    [PERSONEL_ID] AS id,
    [ADY]         AS firstName,
    [FAMILIYASY]  AS lastName,
    [FIRMASY]     AS company
  FROM [BIONET].[dbo].[VW_PERSONEL]
  WHERE (@firm IS NULL OR [FIRMASY] = @firm)
    AND (
      @q IS NULL
      OR [ADY] LIKE @q
      OR [FAMILIYASY] LIKE @q
      OR (@firm IS NULL AND [FIRMASY] LIKE @q)
    )
  ORDER BY [FAMILIYASY], [ADY];
`;

const FIRMS_SQL = `
  SELECT DISTINCT [FIRMASY] AS firm
  FROM [BIONET].[dbo].[VW_PERSONEL]
  WHERE [FIRMASY] IS NOT NULL AND LTRIM(RTRIM([FIRMASY])) <> ''
  ORDER BY [FIRMASY];
`;

export async function search(qRaw, firmRaw) {
  const q = String(qRaw || '').trim().slice(0, 200);
  const firm = String(firmRaw || '').trim().slice(0, 200);
  // Without a query AND without a firm filter, return empty — the picker
  // shouldn't dump the whole directory on first open.
  if (q.length === 0 && firm.length === 0) {
    return { results: [], degraded: false };
  }

  const key = `${firm}|${q}`;
  const cached = fromCache(searchCache, key);
  if (cached) return cached;

  try {
    const pool = await getEmployeesPool();
    const req = pool.request();
    req.input('q', sql.NVarChar(200), q ? `%${q}%` : null);
    req.input('firm', sql.NVarChar(200), firm || null);
    const result = await req.query(SEARCH_SQL);
    const out = { results: normalize(result.recordset), degraded: false };
    setSearchCache(key, out);
    return out;
  } catch (err) {
    console.warn('[employees] search failed, returning degraded:', err.message);
    const out = { results: [], degraded: true };
    setSearchCache(key, out);
    return out;
  }
}

export async function listFirms() {
  const cached = firmsCache && Date.now() - firmsCache.at <= TTL_MS ? firmsCache.value : null;
  if (cached) return cached;

  try {
    const pool = await getEmployeesPool();
    const result = await pool.request().query(FIRMS_SQL);
    const firms = (result.recordset || [])
      .map((r) => String(r.firm || '').trim())
      .filter(Boolean);
    const out = { firms, degraded: false };
    firmsCache = { at: Date.now(), value: out };
    return out;
  } catch (err) {
    console.warn('[employees] listFirms failed, returning degraded:', err.message);
    const out = { firms: [], degraded: true };
    firmsCache = { at: Date.now(), value: out };
    return out;
  }
}

// Lookup by id, used by the read serializer to populate appointment.employee.
// Tries cache by walking entries; for v1 scale this is fine. Returns null
// if not in cache (the DTO will then fall back to visitor_first/last_name).
export function lookupById(id) {
  for (const { value } of searchCache.values()) {
    const hit = value.results.find((r) => r.id === id);
    if (hit) return hit;
  }
  return null;
}

// Test helper.
export function _resetCache() {
  searchCache.clear();
  firmsCache = null;
}
