import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api.js';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry(failureCount, err) {
        if (err instanceof ApiError && err.status === 401) return false;
        return failureCount < 2;
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
