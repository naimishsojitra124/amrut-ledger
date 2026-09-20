import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/services/utils/apiConnector";

/**
 * Opt-out hook for queries and mutations that present their own errors.
 *
 * Declare it as `meta: { suppressErrorToast: true }` on the query/mutation —
 * for example a card lookup where "no customer on this card" is an ordinary
 * outcome rendered inline rather than a failure worth interrupting over.
 */
export interface QueryMeta extends Record<string, unknown> {
  suppressErrorToast?: boolean;
  /** Prefix for the toast, e.g. "Could not save customer". */
  errorTitle?: string;
}

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: QueryMeta;
    mutationMeta: QueryMeta;
  }
}

/**
 * The same failure often arrives several times at once — a page mounting six
 * queries against a server that is down, or an expired session rejecting
 * everything in flight. Showing one toast per rejection buries the screen, so
 * identical messages collapse within a short window.
 */
const TOAST_DEDUPE_WINDOW_MS = 3_000;
const recentToasts = new Map<string, number>();

/**
 * A cancelled request is not a failure — the component unmounted, or the user
 * typed another character into a search box.
 *
 * Some service wrappers re-throw a plain `Error` carrying only the message, so
 * the axios-native checks are not always enough.
 */
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

    // No response at all (offline, server restarting) is worth one retry.
    if (status === undefined) return true;
    if (status === 408 || status === 429) return true;

    return status >= 500;
  }

  return false;
}

export const queryClient = new QueryClient({
  /**
   * Every failed write surfaces to the user. Previously most mutations had no
   * `onError` at all, so a rejected save simply did nothing visible.
   */
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      notifyError(error, mutation.options.meta as QueryMeta | undefined);
    },
  }),

  /**
   * Read failures are announced too, but only once the query has genuinely
   * given up — React Query calls this after retries are exhausted.
   */
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
      /**
       * Refetch when a device is brought back to the front.
       *
       * This is the moment staleness actually matters in a shop: someone picks
       * their tablet back up and needs to see what the other counter recorded
       * while it was face-down. `staleTime` still applies, so a tab flicked
       * away and back does not re-request anything.
       */
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: false,
      // Deliberately no global `placeholderData`: list queries opt into
      // `keepPreviousData` individually. Applying it everywhere would show one
      // customer's details while another customer's request is in flight.
    },
    mutations: {
      retry: 0,
    },
  },
});
