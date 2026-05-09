import { verifyToken } from '../services/auth.js';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';

const STAFF_ROLES = new Set(['secretary', 'assistant1', 'assistant2', 'assistant3']);
const BOSS_ROLES = new Set(['boss1', 'boss2', 'boss3']);

export function requireAuth(req, _res, next) {
  const token = req.cookies?.token;
  if (!token) return next(new UnauthorizedError());
  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      displayName: payload.displayName,
    };
    next();
  } catch {
    next(new UnauthorizedError('invalid_token'));
  }
}

export function requireRole(...allowed) {
  const set = new Set(allowed);
  return (req, _res, next) => {
    if (!req.user) return next(new UnauthorizedError());
    if (!set.has(req.user.role)) return next(new ForbiddenError());
    next();
  };
}

export const requireStaff = (req, _res, next) => {
  if (!req.user) return next(new UnauthorizedError());
  if (!STAFF_ROLES.has(req.user.role)) return next(new ForbiddenError());
  next();
};

export const requireBoss = (req, _res, next) => {
  if (!req.user) return next(new UnauthorizedError());
  if (!BOSS_ROLES.has(req.user.role)) return next(new ForbiddenError());
  next();
};

export { STAFF_ROLES, BOSS_ROLES };
