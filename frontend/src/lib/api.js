// Thin fetch wrapper. Always includes credentials so the JWT cookie travels.
// Rejects with an ApiError carrying the backend's structured {error, ...} body.

const BASE = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  constructor(status, body) {
    const code = body?.error || `http_${status}`;
    super(code);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

async function parseBody(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request(method, path, { body, query } = {}) {
  let url = `${BASE}${path}`;
  if (query && Object.keys(query).length > 0) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }

  const init = {
    method,
    credentials: 'include',
    headers: {},
  };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  const parsed = await parseBody(res);
  if (!res.ok) {
    const err = new ApiError(res.status, parsed);
    // Centralized 401 handling: drop client auth state and bounce to /login.
    if (res.status === 401 && _on401) _on401(err);
    throw err;
  }
  return parsed;
}

// AuthContext registers a handler here on mount so api.* can react to
// 401s without taking a hard dependency on React state.
let _on401 = null;
export function setUnauthorizedHandler(fn) {
  _on401 = fn;
}

export const api = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
  delete: (path, opts) => request('DELETE', path, opts),
};
