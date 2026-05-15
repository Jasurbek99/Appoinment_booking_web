import { rateLimit } from 'express-rate-limit';

// v7 emits a startup warning when 'trust proxy' is on and the validator
// can't statically reason about the chain. We set TRUST_PROXY explicitly
// in config and document its meaning — opt out of the runtime check.
const common = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'rate_limited' },
  validate: { trustProxy: false },
};

// Generic limiter for the whole /api surface. Permissive enough that normal
// staff usage (clicking around lists, modals) never trips it.
export const apiLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  max: 300,
});

// Per-IP login attempts. Defends NAT'd attackers who hammer one account from
// one IP — the per-username limiter below covers the inverse case.
export const loginIpLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  max: 30,
});

// Per-username login attempts. Defends one account being attacked from many
// IPs (credential stuffing, distributed brute force).
export const loginUserLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    const u = typeof req.body?.username === 'string' ? req.body.username.toLowerCase().trim() : '';
    // Fall back to IP when the request lacks a username — combined with
    // loginIpLimiter, this still bounds anonymous attacks.
    return u ? `user:${u}` : `ip:${req.ip ?? 'unknown'}`;
  },
});
