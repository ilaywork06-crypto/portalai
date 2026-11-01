import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { sessionKey } from "@/features/auth/api";
import { errorMessage } from "@/shared/api/errors";
import { ApiError } from "@/shared/api/http";
import { ToastProvider, useToast } from "@/shared/ui/Toast";

const isClientError = (error: unknown) => error instanceof ApiError && error.status < 500;

function QueryProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [client] = useState(() => {
    const expireSession = (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) queryClient.setQueryData(sessionKey, null);
    };
    const queryClient: QueryClient = new QueryClient({
      queryCache: new QueryCache({ onError: expireSession }),
      mutationCache: new MutationCache({
        onError: (error, _variables, _context, mutation) => {
          expireSession(error);
          if (!mutation.options.meta?.silent) toast(errorMessage(error));
        },
      }),
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          refetchOnWindowFocus: false,
          retry: (failures, error) => !isClientError(error) && failures < 2,
        },
      },
    });
    return queryClient;
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <QueryProvider>{children}</QueryProvider>
    </ToastProvider>
  );
}

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { silent?: boolean };
  }
}
