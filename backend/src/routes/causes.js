import { Router } from 'express';
import * as causes from '../services/causes.js';
import { createCauseSchema, updateCauseSchema } from '../schemas/causes.js';
import { requireAuth, requireStaff } from '../middleware/auth.js';
import { ValidationError } from '../lib/errors.js';

export const causesRouter = Router();

// GET is public per SPEC.md §6 — used by the worker public page form, etc.
causesRouter.get('/', async (_req, res, next) => {
  try {
    res.json(await causes.list());
  } catch (err) {
    next(err);
  }
});

causesRouter.post('/', requireAuth, requireStaff, async (req, res, next) => {
  try {
    const parse = createCauseSchema.safeParse(req.body);
    if (!parse.success) throw new ValidationError(parse.error.flatten().fieldErrors);
    const created = await causes.create(parse.data);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

causesRouter.patch('/:id', requireAuth, requireStaff, async (req, res, next) => {
  try {
    const parse = updateCauseSchema.safeParse(req.body);
    if (!parse.success) throw new ValidationError(parse.error.flatten().fieldErrors);
    const updated = await causes.update(req.params.id, parse.data);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

causesRouter.delete('/:id', requireAuth, requireStaff, async (req, res, next) => {
  try {
    await causes.remove(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
