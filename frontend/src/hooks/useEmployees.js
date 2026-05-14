import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useEmployeeSearch(q, firm = '') {
  const qTrim = q.trim();
  return useQuery({
    queryKey: ['employees', qTrim, firm],
    queryFn: () => api.get('/api/employees/search', { query: { q: qTrim, firm } }),
    enabled: qTrim.length > 0 || firm.length > 0,
    keepPreviousData: true,
    staleTime: 5 * 60 * 1000,
  });
}

export function useFirms() {
  return useQuery({
    queryKey: ['employee-firms'],
    queryFn: () => api.get('/api/employees/firms'),
    staleTime: 5 * 60 * 1000,
  });
}
