import { useQuery } from "@tanstack/react-query";

import {
  QUERY_GC_TIMES,
  QUERY_REFETCH_INTERVALS,
  QUERY_STALE_TIMES,
} from "./utils/query-config";
import { apiConnector } from "@/services/utils/apiConnector";

export const healthQueryKeys = {
  status: () => ["service-health"] as const,
};

async function getServiceHealth(signal?: AbortSignal) {
  const response = await apiConnector<{
    status: string;
  }>("GET", "/health", undefined, undefined, undefined, signal);

  return response.data;
}

/**
 * Intentionally short polling because this is a tiny heartbeat endpoint.
 * It is the only query continuously polling at a sub-minute cadence.
 */
export function useServiceHealthQuery() {
  return useQuery({
    queryKey: healthQueryKeys.status(),

    queryFn: ({ signal }) => getServiceHealth(signal),

    staleTime: QUERY_STALE_TIMES.serviceHealth,

    gcTime: QUERY_GC_TIMES.short,

    refetchInterval: QUERY_REFETCH_INTERVALS.serviceHealth,

    refetchIntervalInBackground: false,

    refetchOnWindowFocus: true,

    refetchOnReconnect: true,

    retry: 0,
  });
}
