/**
 * React Query Provider Configuration
 * Centralized data fetching, caching, and state management
 */
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/**
 * Default query client configuration
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 5 minutes
        staleTime: 5 * 60 * 1000,
        // Cache data for 10 minutes
        gcTime: 10 * 60 * 1000,
        // Don't refetch on window focus by default
        refetchOnWindowFocus: false,
        // Retry failed requests 3 times
        retry: 3,
        // Retry with exponential backoff
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
      mutations: {
        // Retry mutations once on failure
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: reuse the singleton if it exists
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * React Query Provider Component
 * Wrap your app with this to enable React Query features
 */
export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(() => getQueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/**
 * Export query client for use in Server Components
 */
export { getQueryClient };
