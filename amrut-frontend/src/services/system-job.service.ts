import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { invalidateSystemJobsChanged } from "./utils/query-invalidation";
import {
  QUERY_GC_TIMES,
  QUERY_REFETCH_INTERVALS,
  QUERY_STALE_TIMES,
  STANDARD_QUERY_BEHAVIOR,
} from "./utils/query-config";
import { apiConnector } from "@/services/utils/apiConnector";

export type SystemJob = {
  id: string;
  name: string;
  schedule: string;
  status: string;
  lastRun: string | null;
  nextRun: string | null;
  failureReason: string | null;
};

const KEY = ["system-jobs"] as const;

export function useSystemJobsQuery() {
  return useQuery({
    queryKey: KEY,

    queryFn: async ({ signal }) =>
      (
        await apiConnector<{
          items: SystemJob[];
        }>("GET", "/system/jobs", undefined, undefined, undefined, signal)
      ).data,

    staleTime: QUERY_STALE_TIMES.systemJobs,
    gcTime: QUERY_GC_TIMES.standard,
    refetchInterval: QUERY_REFETCH_INTERVALS.systemJobs,
    ...STANDARD_QUERY_BEHAVIOR,
  });
}

export function useRetrySystemJobMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      (await apiConnector("POST", `/system/jobs/${id}/retry`)).data,

    onSuccess: async () => {
      await invalidateSystemJobsChanged(queryClient);
    },
  });
}
