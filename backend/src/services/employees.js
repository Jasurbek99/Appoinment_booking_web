// External HR API integration. Spec is not finalized — keep this module
// thin and self-contained so the real endpoint can drop in later.
//
// Contract: search(q) returns { results: [{id, firstName, lastName, company}], degraded }
// - Never throws. degraded=true when EMPLOYEE_API_URL is unset, or fetch
//   rejects, or the API returns non-2xx. The frontend uses degraded to show
//   the manual-entry banner so the create-appointment form still works.
// - Cache results per-query for 5 min in-memory.

import { config } from '../config.js';

const TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // q -> { at, value }

function fromCache(q) {
  const hit = cache.get(q);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(q);
    return null;
  }
  return hit.value;
}

function setCache(q, value) {
  cache.set(q, { at: Date.now(), value });
  if (cache.size > 1000) {
    // Evict oldest entries lazily
    for (const k of cache.keys()) {
      cache.delete(k);
      if (cache.size <= 800) break;
    }
  }
}

function normalize(payload) {
  if (!Array.isArray(payload)) return [];
  return payload
    .slice(0, 20)
    .map((row) => ({
      id: Number(row.id),
      firstName: String(row.firstName || row.first_name || ''),
      lastName: String(row.lastName || row.last_name || ''),
      company: String(row.company || ''),
    }))
    .filter((r) => Number.isFinite(r.id) && r.firstName && r.lastName);
}

export async function search(qRaw) {
  const q = String(qRaw || '').trim().slice(0, 200);
  if (q.length === 0) return { results: [], degraded: false };

  const cached = fromCache(q);
  if (cached) return cached;

  if (!config.employeeApi.url) {
    const out = { results: [], degraded: true };
    setCache(q, out);
    return out;
  }

  try {
    const url = new URL(config.employeeApi.url);
    url.searchParams.set('q', q);
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: config.employeeApi.key
        ? { Authorization: `Bearer ${config.employeeApi.key}` }
        : {},
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      const out = { results: [], degraded: true };
      setCache(q, out);
      return out;
    }
    const json = await res.json();
    const out = { results: normalize(json), degraded: false };
    setCache(q, out);
    return out;
  } catch {
    const out = { results: [], degraded: true };
    setCache(q, out);
    return out;
  }
}

// Lookup by id, used by the read serializer to populate appointment.employee.
// Tries cache by walking entries; for v1 scale this is fine. Returns null
// if not in cache (the DTO will then fall back to visitor_first/last_name).
export function lookupById(id) {
  for (const { value } of cache.values()) {
    const hit = value.results.find((r) => r.id === id);
    if (hit) return hit;
  }
  return null;
}

// Test helper.
export function _resetCache() {
  cache.clear();
}
