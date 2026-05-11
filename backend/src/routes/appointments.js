import { Router } from 'express';
import { z } from 'zod';
import { listAppointments, loadFullDTO } from '../services/appointments.read.js';
import { requireAuth, BOSS_ROLES, STAFF_ROLES } from '../middleware/auth.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../lib/errors.js';

export const appointmentsRouter = Router();

appointmentsRouter.use(requireAuth, (req, _res, next) => {
  if (!STAFF_ROLES.has(req.user.role) && !BOSS_ROLES.has(req.user.role)) {
    return next(new ForbiddenError());
  }
  next();
});

const listQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  boss_id: z.enum(['boss1', 'boss2', 'boss3']).optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'invited', 'completed']).optional(),
  future: z.enum(['true', 'false']).optional(),
  mode: z.enum(['today', 'future', 'all']).optional(),
});

appointmentsRouter.get('/', async (req, res, next) => {
  try {
    const parse = listQuerySchema.safeParse(req.query);
    if (!parse.success) throw new ValidationError(parse.error.flatten().fieldErrors);

    const q = parse.data;
    let mode = q.mode;
    if (!mode) {
      if (q.future === 'true') mode = 'future';
      else if (q.date) mode = 'date';
      else mode = 'today';
    }

    // Boss role auto-scopes to its own boss_id, ignoring any forged ?boss_id.
    let bossId = q.boss_id;
    if (BOSS_ROLES.has(req.user.role)) {
      bossId = req.user.role; // role IS the boss_id ('boss1'|...)
    }

    const opts = { mode, bossId, status: q.status, date: q.date };
    const list = await listAppointments(opts);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

appointmentsRouter.get('/:id/history', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) throw new ValidationError({ id: ['must be integer'] });
    const dto = await loadFullDTO(id);
    if (!dto) throw new NotFoundError();
    if (BOSS_ROLES.has(req.user.role) && dto.bossId !== req.user.role) {
      throw new ForbiddenError();
    }
    res.json(dto.history);
  } catch (err) {
    next(err);
  }
});
