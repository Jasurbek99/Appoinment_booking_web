import { z } from 'zod';

export const createCauseSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9_-]+$/, 'id must be lowercase letters, digits, _ -'),
  label_ru: z.string().min(1).max(200),
  label_tk: z.string().min(1).max(200),
});

export const updateCauseSchema = z.object({
  label_ru: z.string().min(1).max(200).optional(),
  label_tk: z.string().min(1).max(200).optional(),
});
