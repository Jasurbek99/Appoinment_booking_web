import { Router } from 'express';
import { z } from 'zod';
import { search } from '../services/employees.js';
import { requireAuth } from '../middleware/auth.js';
import { ValidationError } from '../lib/errors.js';

export const employeesRouter = Router();

const querySchema = z.object({ q: z.string().max(200).optional().default('') });

employeesRouter.get('/search', requireAuth, async (req, res, next) => {
  try {
    const parse = querySchema.safeParse(req.query);
    if (!parse.success) throw new ValidationError(parse.error.flatten().fieldErrors);
    const out = await search(parse.data.q);
    res.json(out);
  } catch (err) {
    next(err);
  }
});
