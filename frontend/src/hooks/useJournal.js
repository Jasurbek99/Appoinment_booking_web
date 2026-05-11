import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useJournal(filters) {
  return useQuery({
    queryKey: ['journal', filters],
    queryFn: () => api.get('/api/journal', { query: filters }),
  });
}
