// Fan-out per SPEC.md §7. Called by route handlers AFTER the write service
// has resolved (i.e. the DB transaction has committed). Never call from
// inside a service or transaction — emission must follow commit so a
// rollback never leaks an event.

function visitorLastName(dto) {
  if (dto?.visitor?.lastName) return dto.visitor.lastName.toLowerCase();
  if (dto?.employee?.lastName) return dto.employee.lastName.toLowerCase();
  return null;
}

export function emitAppointmentEvent(io, action, dto) {
  if (!io) {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[emit:noop] ${action} appointment ${dto?.id}`);
    }
    return;
  }

  const event = `appointment:${action}`;

  // Always notify staff.
  io.to('staff').emit(event, dto);

  // Always notify the relevant boss room.
  if (dto?.bossId) {
    io.to(dto.bossId).emit(event, dto);
  }

  // Notify the public:<lastname> room for status changes that workers care about.
  const lastName = visitorLastName(dto);
  if (lastName && (action === 'approved' || action === 'rejected' || action === 'invited' || action === 'completed')) {
    io.to(`public:${lastName}`).emit(event, {
      // Trim to public-safe fields; the full DTO is fine for staff/boss rooms,
      // but workers shouldn't receive history with internal user IDs.
      id: dto.id,
      bossId: dto.bossId,
      status: dto.status,
      date: dto.date,
      visitor: dto.visitor,
      employee: dto.employee
        ? { firstName: dto.employee.firstName, lastName: dto.employee.lastName, company: dto.employee.company }
        : null,
    });
  }
}
