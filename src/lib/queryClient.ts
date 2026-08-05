import { QueryClient } from '@tanstack/react-query';

/**
 * Global TanStack Query client.
 *
 * Defaults:
 *  - staleTime: 0 — every query defines its own TTL via the queryKey options
 *  - retry: 1     — retry once on transient API failures
 *  - refetchOnWindowFocus: false — odds won't auto-refresh mid-session
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 0,
    },
  },
});
