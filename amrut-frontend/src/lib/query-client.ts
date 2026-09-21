import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/services/utils/apiConnector";

export interface QueryMeta extends Record<string, unknown> {
  suppressErrorToast?: boolean;
  errorTitle?: string;
}

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: QueryMeta;
    mutationMeta: QueryMeta;
  }
}

// One dead server rejects every query on the page; identical messages collapse into one toast.
const TOAST_DEDUPE_WINDOW_MS = 3_000;
const recentToasts = new Map<string, number>();

// An unmounted component or a changed search box is not a failure worth reporting.
function isCancellation(error: unknown): boolean {
  if (axios.isCancel(error)) return true;
  if (axios.isAxiosError(error) && error.code === "ERR_CANCELED") return true;

  if (error instanceof Error) {
    if (error.name === "AbortError" || error.name === "CanceledError") return true;
    if (error.message === "canceled" || error.message === "Request aborted") return true;
  }

  return false;
}

function notifyError(error: unknown, meta: QueryMeta | undefined) {
  if (meta?.suppressErrorToast) return;

  if (isCancellation(error)) return;

  const message = getApiErrorMessage(error);
  const text = meta?.errorTitle ? `${meta.errorTitle}: ${message}` : message;

  const now = Date.now();
  const lastShown = recentToasts.get(text);

  if (lastShown !== undefined && now - lastShown < TOAST_DEDUPE_WINDOW_MS) return;

  recentToasts.set(text, now);

  // Keep the map from growing across a long session.
  for (const [key, shownAt] of recentToasts) {
    if (now - shownAt > TOAST_DEDUPE_WINDOW_MS) recentToasts.delete(key);
  }

  toast.error(text);
}

/** 4xx responses are the caller's fault; retrying them only adds latency. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    if (status === undefined) return true;
    if (status === 408 || status === 429) return true;

    return status >= 500;
  }

  return false;
}

export const queryClient = new QueryClient({
  // Every failed write surfaces here, so a rejected save can never just do nothing.
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      notifyError(error, mutation.options.meta as QueryMeta | undefined);
    },
  }),

  // Reads report only once React Query has exhausted its retries.
  queryCache: new QueryCache({
    onError: (error, query) => {
      notifyError(error, query.meta as QueryMeta | undefined);
    },
  }),

  defaultOptions: {
    queries: {
      retry: shouldRetry,
      staleTime: 1000 * 60,
      gcTime: 1000 * 60 * 5,
      // Picking a tablet back up should show what the other counter recorded meanwhile.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
