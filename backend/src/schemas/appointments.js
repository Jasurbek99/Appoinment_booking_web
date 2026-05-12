import { z } from 'zod';

export const VISITOR_TYPES = ['employee', 'guest', 'foreign'];
export const BOSS_IDS = ['boss1', 'boss2', 'boss3'];
export const STATUSES = ['pending', 'approved', 'rejected', 'invited', 'completed'];
export const ACTIONS = ['create', 'approve', 'reject', 'invite', 'complete'];

const visitorPerson = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  company: z.string().max(200).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
});

export const createAppointmentSchema = z
  .object({
    visitorType: z.enum(VISITOR_TYPES),
    employeeId: z.number().int().positive().optional().nullable(),
    visitor: visitorPerson.optional().nullable(),
    bossId: z.enum(BOSS_IDS),
    causeId: z.string().min(1).max(50),
    customCause: z.string().max(500).optional().nullable(),
    urgent: z.boolean().default(false),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .superRefine((data, ctx) => {
    if (data.causeId === 'other' && !data.customCause?.trim()) {
      ctx.addIssue({
        path: ['customCause'],
        code: z.ZodIssueCode.custom,
        message: 'customCause is required when causeId is "other"',
      });
    }
    if (data.visitorType === 'employee') {
      const hasEmployeeId = !!data.employeeId;
      const hasManual = data.visitor?.firstName && data.visitor?.lastName;
      if (!hasEmployeeId && !hasManual) {
        ctx.addIssue({
          path: ['visitor'],
          code: z.ZodIssueCode.custom,
          message: 'employee visitor needs employeeId or full manual visitor data',
        });
      }
    } else {
      if (!data.visitor?.firstName || !data.visitor?.lastName) {
        ctx.addIssue({
          path: ['visitor'],
          code: z.ZodIssueCode.custom,
          message: 'guest/foreign requires visitor.firstName and visitor.lastName',
        });
      }
    }
  });

export const rejectSchema = z.object({
  reason: z.string().max(500).optional(),
});
