import { Router } from 'express';
import { z } from 'zod';
import { search, listFirms } from '../services/employees.js';
import { requireAuth } from '../middleware/auth.js';
import { ValidationError } from '../lib/errors.js';

export const employeesRouter = Router();

const searchSchema = z.object({
  q: z.string().max(200).optional().default(''),
  firm: z.string().max(200).optional().default(''),
});

employeesRouter.get('/search', requireAuth, async (req, res, next) => {
  try {
    const parse = searchSchema.safeParse(req.query);
    if (!parse.success) throw new ValidationError(parse.error.flatten().fieldErrors);
    const out = await search(parse.data.q, parse.data.firm);
    res.json(out);
  } catch (err) {
    next(err);
  }
});

employeesRouter.get('/firms', requireAuth, async (_req, res, next) => {
  try {
    const out = await listFirms();
    res.json(out);
  } catch (err) {
    next(err);
  }
});
