import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

const KEY = 'causes';

export function useCauses() {
  return useQuery({
    queryKey: [KEY],
    queryFn: () => api.get('/api/causes'),
    staleTime: 60_000,
  });
}

export function useCreateCause() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post('/api/causes', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateCause() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }) => api.patch(`/api/causes/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteCause() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/api/causes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
