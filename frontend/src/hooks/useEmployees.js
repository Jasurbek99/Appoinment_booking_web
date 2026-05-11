import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useEmployeeSearch(q) {
  return useQuery({
    queryKey: ['employees', q],
    queryFn: () => api.get('/api/employees/search', { query: { q } }),
    enabled: q.trim().length > 0,
    keepPreviousData: true,
    staleTime: 5 * 60 * 1000,
  });
}
