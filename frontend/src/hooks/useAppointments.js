import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

const KEY = 'appointments';

export function useAppointments({ mode = 'today' } = {}) {
  return useQuery({
    queryKey: [KEY, mode],
    queryFn: () => api.get('/api/appointments', { query: mode === 'future' ? { future: 'true' } : { mode } }),
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, force }) =>
      api.post('/api/appointments', input, { query: force ? { force: 'true' } : {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useBulkReschedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shiftDays, causeId, reason }) => {
      const body = { shiftDays };
      if (causeId) body.causeId = causeId;
      if (reason) body.reason = reason;
      return api.post('/api/appointments/bulk-reschedule', body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useTransitionAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, reason, causeId, date }) => {
      const body = {};
      if (action === 'reject') {
        if (reason) body.reason = reason;
        if (causeId) body.causeId = causeId;
      } else if (action === 'reschedule') {
        body.date = date;
        if (reason) body.reason = reason;
        if (causeId) body.causeId = causeId;
      }
      return api.patch(`/api/appointments/${id}/${action}`, body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
