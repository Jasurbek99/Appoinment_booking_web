import { Router } from 'express';
import { z } from 'zod';
import { listPublicByLastName } from '../services/appointments.read.js';
import { ValidationError } from '../lib/errors.js';

export const publicRouter = Router();

const searchSchema = z.object({
  lastname: z.string().min(1).max(100),
});

publicRouter.get('/appointments', async (req, res, next) => {
  try {
    const parse = searchSchema.safeParse(req.query);
    if (!parse.success) throw new ValidationError(parse.error.flatten().fieldErrors);
    const list = await listPublicByLastName(parse.data.lastname);
    res.json(list);
  } catch (err) {
    next(err);
  }
});
