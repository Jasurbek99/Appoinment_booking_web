import { Router } from 'express';
import { z } from 'zod';
import { listAppointments, loadFullDTO } from '../services/appointments.read.js';
import * as writeSvc from '../services/appointments.write.js';
import { createAppointmentSchema, rejectSchema } from '../schemas/appointments.js';
import { requireAuth, requireStaff, BOSS_ROLES, STAFF_ROLES } from '../middleware/auth.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../lib/errors.js';
import { emitAppointmentEvent } from '../sockets/emit.js';

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

appointmentsRouter.post('/', requireStaff, async (req, res, next) => {
  try {
    const parse = createAppointmentSchema.safeParse(req.body);
    if (!parse.success) throw new ValidationError(parse.error.flatten());
    const force = req.query.force === 'true';
    const dto = await writeSvc.create({ input: parse.data, actor: req.user, force });
    emitAppointmentEvent(req.app.get('io'), 'created', dto);
    res.status(201).json(dto);
  } catch (err) {
    next(err);
  }
});

const ACTION_TO_EVENT = {
  approve: 'approved',
  reject: 'rejected',
  invite: 'invited',
  complete: 'completed',
};

function transitionRoute(action, schema = null) {
  return async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) throw new ValidationError({ id: ['must be integer'] });
      let note;
      if (schema) {
        const parse = schema.safeParse(req.body || {});
        if (!parse.success) throw new ValidationError(parse.error.flatten().fieldErrors);
        note = parse.data.reason;
      }
      const dto = await writeSvc.transition({ id, action, actor: req.user, note });
      emitAppointmentEvent(req.app.get('io'), ACTION_TO_EVENT[action], dto);
      res.json(dto);
    } catch (err) {
      next(err);
    }
  };
}

appointmentsRouter.patch('/:id/approve', transitionRoute('approve'));
appointmentsRouter.patch('/:id/reject', transitionRoute('reject', rejectSchema));
appointmentsRouter.patch('/:id/invite', transitionRoute('invite'));
appointmentsRouter.patch('/:id/complete', transitionRoute('complete'));

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
