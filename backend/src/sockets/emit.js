// Step 6 stub: a no-op until Step 14 wires up Socket.io.
// Routes call this AFTER appointments.write returns — never inside a transaction.
// When Step 14 lands, this file is replaced with the real emitter.

export function emitAppointmentEvent(io, action, dto) {
  if (!io) {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[emit:stub] ${action} appointment ${dto?.id}`);
    }
    return;
  }
  // Real fan-out lives in Step 14. Keep this branch ready so the route signature
  // doesn't change when sockets land.
  io.to('staff').emit(`appointment:${action}`, dto);
  if (dto?.bossId) io.to(dto.bossId).emit(`appointment:${action}`, dto);
}
