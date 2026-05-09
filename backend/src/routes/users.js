import { Router } from 'express';
import * as users from '../services/users.js';
import { createUserSchema, updateUserSchema } from '../schemas/users.js';
import { requireAuth, requireStaff } from '../middleware/auth.js';
import { ValidationError, ForbiddenError } from '../lib/errors.js';

export const usersRouter = Router();

usersRouter.use(requireAuth, requireStaff);

usersRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await users.listActive();
    res.json(rows.map(toDto));
  } catch (err) {
    next(err);
  }
});

usersRouter.post('/', async (req, res, next) => {
  try {
    const parse = createUserSchema.safeParse(req.body);
    if (!parse.success) throw new ValidationError(parse.error.flatten().fieldErrors);
    const created = await users.create(parse.data);
    res.status(201).json(toDto(created));
  } catch (err) {
    next(err);
  }
});

usersRouter.patch('/:id', async (req, res, next) => {
  try {
    const parse = updateUserSchema.safeParse(req.body);
    if (!parse.success) throw new ValidationError(parse.error.flatten().fieldErrors);
    if (req.params.id === req.user.id && parse.data.role && parse.data.role !== req.user.role) {
      throw new ForbiddenError('cannot change own role', 'forbidden_self');
    }
    const updated = await users.update(req.params.id, parse.data);
    res.json(toDto(updated));
  } catch (err) {
    next(err);
  }
});

usersRouter.delete('/:id', async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      throw new ForbiddenError('cannot delete self', 'forbidden_self');
    }
    await users.softDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

function toDto(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    username: row.username,
    role: row.role,
  };
}
