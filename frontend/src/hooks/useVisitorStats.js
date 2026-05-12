import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useVisitorStats(filters = {}) {
  return useQuery({
    queryKey: ['stats', 'visitors', filters],
    queryFn: () => api.get('/api/stats/visitors', { query: filters }),
    refetchInterval: 60_000,
  });
}
