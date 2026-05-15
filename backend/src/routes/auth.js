import { Router } from 'express';
import { z } from 'zod';
import { findByUsername } from '../services/users.js';
import { verifyPassword, signToken } from '../services/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { loginIpLimiter, loginUserLimiter } from '../middleware/rateLimit.js';
import { ValidationError, UnauthorizedError } from '../lib/errors.js';
import { config } from '../config.js';

const loginSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(200),
});

const COOKIE_NAME = 'token';
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProduction,
  maxAge: 24 * 60 * 60 * 1000,
  path: '/',
};

export const authRouter = Router();

authRouter.post('/login', loginIpLimiter, loginUserLimiter, async (req, res, next) => {
  try {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) throw new ValidationError(parse.error.flatten().fieldErrors);

    const { username, password } = parse.data;
    const user = await findByUsername(username);
    if (!user) throw new UnauthorizedError('invalid_credentials');

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) throw new UnauthorizedError('invalid_credentials');

    const token = signToken(user);
    res.cookie(COOKIE_NAME, token, cookieOptions);
    res.json({
      id: user.id,
      displayName: user.display_name,
      role: user.role,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    displayName: req.user.displayName,
    role: req.user.role,
  });
});
