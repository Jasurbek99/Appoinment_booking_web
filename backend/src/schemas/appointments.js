import { z } from 'zod';

export const VISITOR_TYPES = ['employee', 'guest', 'foreign'];
export const BOSS_IDS = ['boss1', 'boss2', 'boss3'];
export const STATUSES = ['pending', 'approved', 'rejected', 'invited', 'completed'];
export const ACTIONS = ['create', 'approve', 'reject', 'invite', 'complete', 'reschedule'];

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
  causeId: z.string().min(1).max(50).optional(),
  reason: z.string().max(500).optional(),
});

export const rescheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  causeId: z.string().min(1).max(50).optional(),
  // Tighter cap than 500 because the reschedule note is stored as JSON in
  // appointment_history.note NVARCHAR(500) alongside oldDate/newDate/causeId.
  reason: z.string().max(380).optional(),
});

// Shift every approved/invited appointment for the calling boss from today
// onward by N days. Reason field cap matches rescheduleSchema for the same
// JSON-in-NVARCHAR(500) reason.
export const bulkRescheduleSchema = z.object({
  shiftDays: z.number().int().min(1).max(365),
  causeId: z.string().min(1).max(50).optional(),
  reason: z.string().max(380).optional(),
});
