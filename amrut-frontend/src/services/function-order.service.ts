import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { invalidateFunctionOrdersChanged } from "./utils/query-invalidation";
import {
  QUERY_GC_TIMES,
  QUERY_REFETCH_INTERVALS,
  QUERY_STALE_TIMES,
  STANDARD_QUERY_BEHAVIOR,
} from "./utils/query-config";
import { apiConnector } from "./utils/apiConnector";

import type {
  FunctionOrderAuditLog,
  FunctionOrderInput,
  FunctionOrderListQuery,
  FunctionOrderListResponse,
} from "@/types/function-order";

export const functionOrderQueryKeys = {
  all: ["function-orders"] as const,

  list: (query: FunctionOrderListQuery = {}) =>
    [
      "function-orders",
      "list",
      {
        page: query.page ?? 1,
        limit: query.limit ?? 10,
        status: query.status ?? null,
        search: query.search?.trim() ?? "",
      },
    ] as const,

  auditLogs: (id: string | null) =>
    ["function-orders", "audit-logs", id ?? ""] as const,

  reminders: () => ["function-orders", "reminders"] as const,
};

export const useFunctionOrdersQuery = (query: FunctionOrderListQuery = {}) =>
  useQuery<FunctionOrderListResponse>({
    queryKey: functionOrderQueryKeys.list(query),

    queryFn: async ({ signal }) => {
      const params = Object.fromEntries(
        Object.entries({
          page: query.page,
          limit: query.limit,
          status: query.status,
          search: query.search?.trim(),
        }).filter(
          ([, value]) => value !== undefined && value !== null && value !== "",
        ),
      );

      const response = await apiConnector<FunctionOrderListResponse>(
        "GET",
        "/function-orders",
        undefined,
        undefined,
        params,
        signal,
      );

      return response.data;
    },

    staleTime: QUERY_STALE_TIMES.functionOrdersList,
    gcTime: QUERY_GC_TIMES.standard,
    refetchInterval: QUERY_REFETCH_INTERVALS.functionOrdersList,
    ...STANDARD_QUERY_BEHAVIOR,
    placeholderData: keepPreviousData,
  });

export const useFunctionOrderAuditLogsQuery = (id: string | null) =>
  useQuery<{
    items: FunctionOrderAuditLog[];
  }>({
    queryKey: functionOrderQueryKeys.auditLogs(id),

    queryFn: async ({ signal }) => {
      if (!id) {
        throw new Error("Function order ID is required.");
      }

      const response = await apiConnector<{
        items: FunctionOrderAuditLog[];
      }>(
        "GET",
        `/function-orders/${id}/audit-logs`,
        undefined,
        undefined,
        undefined,
        signal,
      );

      return response.data;
    },

    enabled: Boolean(id),
    staleTime: QUERY_STALE_TIMES.functionOrderAuditLogs,
    gcTime: QUERY_GC_TIMES.long,
    ...STANDARD_QUERY_BEHAVIOR,
  });

export const useCreateFunctionOrderMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: FunctionOrderInput) => {
      const response = await apiConnector("POST", "/function-orders", payload);

      return response.data;
    },

    onSuccess: async () => {
      await invalidateFunctionOrdersChanged(queryClient);
    },
  });
};

export const useUpdateFunctionOrderMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      id: string;
      input: Partial<FunctionOrderInput>;
    }) => {
      const response = await apiConnector(
        "PATCH",
        `/function-orders/${args.id}`,
        args.input,
      );

      return response.data;
    },

    onSuccess: async (_, variables) => {
      await invalidateFunctionOrdersChanged(queryClient, variables.id);
    },
  });
};

export const useDeleteFunctionOrderMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiConnector("DELETE", `/function-orders/${id}`);

      return response.data;
    },

    onSuccess: async (_, id) => {
      await invalidateFunctionOrdersChanged(queryClient, id);
    },
  });
};
