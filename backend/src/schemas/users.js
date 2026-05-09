import { z } from 'zod';

export const ROLES = [
  'secretary',
  'assistant1',
  'assistant2',
  'assistant3',
  'boss1',
  'boss2',
  'boss3',
];

const RoleEnum = z.enum(ROLES);

export const createUserSchema = z.object({
  display_name: z.string().min(1).max(200),
  username: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'username may contain only letters, digits, _ . -'),
  password: z.string().min(6).max(200),
  role: RoleEnum,
});

export const updateUserSchema = z.object({
  display_name: z.string().min(1).max(200).optional(),
  username: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/)
    .optional(),
  password: z.string().min(6).max(200).optional(),
  role: RoleEnum.optional(),
});
