import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import axios from "axios";

import { apiConnector } from "./utils/apiConnector";
import {
  invalidateCustomerCreated,
  invalidateCustomerDepositChanged,
  invalidateCustomerStatusChanged,
  invalidateCustomerUpdated,
} from "./utils/query-invalidation";
import {
  FINANCIAL_QUERY_BEHAVIOR,
  QUERY_GC_TIMES,
  QUERY_REFETCH_INTERVALS,
  QUERY_STALE_TIMES,
  STANDARD_QUERY_BEHAVIOR,
} from "./utils/query-config";

import {
  type CreateCustomerRequest,
  type Customer,
  type CustomerAuditLogResponse,
  type CustomerBillsQuery,
  type CustomerDailyHistoryQuery,
  type CustomerListItemResponse,
  type CustomerListQuery,
  type CustomerPaymentsQuery,
  type CustomerPaymentListResponse,
  type CustomerBillListResponse,
  type CustomerStatsResponse,
  type CustomerDailyHistoryResponse,
  type UpdateCustomerRequest,
  type CustomerAuditLogsQuery,
  type CustomerListResponse,
  type CustomerResponse,
} from "@/types/customer";

function cleanParams(params: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => {
      return (
        value !== undefined &&
        value !== null &&
        value !== "" &&
        !(typeof value === "number" && Number.isNaN(value))
      );
    }),
  );
}

function mapCustomer(customer: CustomerListItemResponse) {
  return {
    ...customer,
    primaryMilk: customer.milkTypes.find((item) => item.isDefault) ?? null,
    cardNumber: customer.currentCard?.cardNumber ?? null,
    outstandingAmount: customer.outstandingAmount ?? 0,
    lastEntryAt: customer.lastEntryAt ?? null,
  };
}

export const customerQueryKeys = {
  all: ["customers"] as const,
  list: (query: CustomerListQuery = {}) =>
    [
      "customers",
      "list",
      {
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        status: query.status ?? null,
        search: query.search?.trim() ?? "",
      },
    ] as const,
  stats: () => ["customers", "stats"] as const,
  cardLookup: (cardNumber: string) =>
    ["customers", "card-lookup", cardNumber] as const,
  detail: (customerId: string | null) =>
    ["customers", "detail", customerId ?? ""] as const,
  dailyHistory: (
    customerId: string | null,
    query: CustomerDailyHistoryQuery = {},
  ) =>
    [
      "customers",
      "daily-history",
      customerId ?? "",
      query.month ?? null,
      query.year ?? null,
    ] as const,
  bills: (customerId: string | null, query: CustomerBillsQuery = {}) =>
    [
      "customers",
      "bills",
      customerId ?? "",
      query.page ?? 1,
      query.limit ?? 20,
      query.search?.trim() ?? "",
    ] as const,
  payments: (customerId: string | null, query: CustomerPaymentsQuery = {}) =>
    [
      "customers",
      "payments",
      customerId ?? "",
      query.page ?? 1,
      query.limit ?? 20,
      query.billId ?? null,
      query.billMonth ?? null,
      query.billYear ?? null,
      query.paymentMethod ?? null,
      query.search?.trim() ?? "",
    ] as const,
  auditLogs: (customerId: string | null, query: CustomerAuditLogsQuery = {}) =>
    [
      "customers",
      "audit-logs",
      customerId ?? "",
      query.page ?? 1,
      query.limit ?? 20,
      query.types?.join(",") ?? "",
    ] as const,
  statement: (customerId: string | null) =>
    ["customers", "statement", customerId ?? ""] as const,
};

export async function getCustomerDailyHistory(
  customerId: string,
  query: { month?: number; year?: number },
  signal?: AbortSignal,
): Promise<CustomerDailyHistoryResponse> {
  const response = await apiConnector<CustomerDailyHistoryResponse>(
    "GET",
    `/customers/${customerId}/daily-history`,
    undefined,
    undefined,
    { month: query.month, year: query.year },
    signal,
  );
  return response.data;
}

export const useCustomersQuery = (query: CustomerListQuery = {}) => {
  const normalizedQuery = {
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    status: query.status,
    search: query.search?.trim() ?? "",
  };
  return useQuery({
    queryKey: customerQueryKeys.list(normalizedQuery),
    queryFn: async ({ signal }) => {
      const res = await apiConnector<CustomerListResponse>(
        "GET",
        "/customers",
        undefined,
        undefined,
        cleanParams(normalizedQuery),
        signal,
      );
      return { ...res.data, items: res.data.items.map(mapCustomer) };
    },
    staleTime: QUERY_STALE_TIMES.customersList,
    gcTime: QUERY_GC_TIMES.standard,
    refetchInterval: QUERY_REFETCH_INTERVALS.customersList,
    ...STANDARD_QUERY_BEHAVIOR,
    placeholderData: keepPreviousData,
  });
};

export const useCustomerByCardNumberQuery = (
  cardNumber: string,
  enabled = true,
) =>
  useQuery<CustomerResponse | null>({
    queryKey: customerQueryKeys.cardLookup(cardNumber),
    queryFn: async ({ signal }) => {
      if (!cardNumber) return null;
      try {
        const res = await apiConnector<CustomerResponse>(
          "GET",
          "/customers/lookup",
          undefined,
          undefined,
          { cardNumber },
          signal,
        );
        return res.data;
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404)
          return null;
        throw error;
      }
    },
    enabled: Boolean(enabled && cardNumber),
    staleTime: 0,
    gcTime: QUERY_GC_TIMES.standard,
    ...STANDARD_QUERY_BEHAVIOR,
  });

export const useCustomerStatsQuery = () =>
  useQuery<CustomerStatsResponse>({
    queryKey: customerQueryKeys.stats(),
    queryFn: async ({ signal }) =>
      (
        await apiConnector<CustomerStatsResponse>(
          "GET",
          "/customers/stats",
          undefined,
          undefined,
          undefined,
          signal,
        )
      ).data,
    staleTime: QUERY_STALE_TIMES.customerStats,
    gcTime: QUERY_GC_TIMES.standard,
    refetchInterval: QUERY_REFETCH_INTERVALS.customerStats,
    ...STANDARD_QUERY_BEHAVIOR,
  });

export const useCustomerQuery = (customerId: string | null) =>
  useQuery<Customer>({
    queryKey: customerQueryKeys.detail(customerId),
    queryFn: async ({ signal }) => {
      if (!customerId) throw new Error("Customer ID is required.");
      return (
        await apiConnector<CustomerResponse>(
          "GET",
          `/customers/${customerId}`,
          undefined,
          undefined,
          undefined,
          signal,
        )
      ).data;
    },
    enabled: Boolean(customerId),
    staleTime: QUERY_STALE_TIMES.customerDetail,
    gcTime: QUERY_GC_TIMES.standard,
    ...STANDARD_QUERY_BEHAVIOR,
  });

export const useCustomerDailyHistoryQuery = (
  customerId: string | null,
  query: CustomerDailyHistoryQuery = {},
) =>
  useQuery<CustomerDailyHistoryResponse>({
    queryKey: customerQueryKeys.dailyHistory(customerId, query),
    queryFn: ({ signal }) => {
      if (!customerId) throw new Error("Customer ID is required.");
      return getCustomerDailyHistory(
        customerId,
        { month: query.month, year: query.year },
        signal,
      );
    },
    enabled: Boolean(customerId && query.month && query.year),
    staleTime: QUERY_STALE_TIMES.customerDailyHistory,
    gcTime: QUERY_GC_TIMES.standard,
    ...STANDARD_QUERY_BEHAVIOR,
    placeholderData: keepPreviousData,
  });

export const useCustomerBillsQuery = (
  customerId: string | null,
  query: CustomerBillsQuery = {},
) =>
  useQuery<CustomerBillListResponse>({
    queryKey: customerQueryKeys.bills(customerId, query),
    queryFn: async ({ signal }) => {
      if (!customerId) throw new Error("Customer ID is required.");
      return (
        await apiConnector<CustomerBillListResponse>(
          "GET",
          `/customers/${customerId}/bills`,
          undefined,
          undefined,
          cleanParams({
            page: query.page,
            limit: query.limit,
            search: query.search?.trim(),
          }),
          signal,
        )
      ).data;
    },
    enabled: Boolean(customerId),
    staleTime: QUERY_STALE_TIMES.customerBills,
    gcTime: QUERY_GC_TIMES.standard,
    ...FINANCIAL_QUERY_BEHAVIOR,
    placeholderData: keepPreviousData,
  });

export const useCustomerPaymentsQuery = (
  customerId: string | null,
  query: CustomerPaymentsQuery = {},
) =>
  useQuery<CustomerPaymentListResponse>({
    queryKey: customerQueryKeys.payments(customerId, query),
    queryFn: async ({ signal }) => {
      if (!customerId) throw new Error("Customer ID is required.");
      return (
        await apiConnector<CustomerPaymentListResponse>(
          "GET",
          `/customers/${customerId}/payments`,
          undefined,
          undefined,
          cleanParams({
            page: query.page,
            limit: query.limit,
            billId: query.billId,
            billMonth: query.billMonth,
            billYear: query.billYear,
            paymentMethod: query.paymentMethod,
            search: query.search?.trim(),
          }),
          signal,
        )
      ).data;
    },
    enabled: Boolean(customerId),
    staleTime: QUERY_STALE_TIMES.customerPayments,
    gcTime: QUERY_GC_TIMES.standard,
    ...FINANCIAL_QUERY_BEHAVIOR,
    placeholderData: keepPreviousData,
  });

export const useCustomerAuditLogsQuery = (
  customerId: string | null,
  query: CustomerAuditLogsQuery = {},
) =>
  useQuery<CustomerAuditLogResponse>({
    queryKey: customerQueryKeys.auditLogs(customerId, query),
    queryFn: async ({ signal }) => {
      if (!customerId) throw new Error("Customer ID is required.");
      return (
        await apiConnector<CustomerAuditLogResponse>(
          "GET",
          `/customers/${customerId}/audit-logs`,
          undefined,
          undefined,
          cleanParams({
            page: query.page,
            limit: query.limit,
            types: query.types?.join(","),
          }),
          signal,
        )
      ).data;
    },
    enabled: Boolean(customerId),
    staleTime: QUERY_STALE_TIMES.customerAuditLogs,
    gcTime: QUERY_GC_TIMES.long,
    ...STANDARD_QUERY_BEHAVIOR,
    placeholderData: keepPreviousData,
  });

export const useCustomerStatementQuery = (customerId: string | null) =>
  useQuery<CustomerStatement>({
    queryKey: customerQueryKeys.statement(customerId),
    queryFn: async ({ signal }) => {
      if (!customerId) throw new Error("Customer ID is required.");
      return (
        await apiConnector<CustomerStatement>(
          "GET",
          `/customers/${customerId}/statement`,
          undefined,
          undefined,
          undefined,
          signal,
        )
      ).data;
    },
    enabled: Boolean(customerId),
    staleTime: QUERY_STALE_TIMES.customerStatement,
    gcTime: QUERY_GC_TIMES.standard,
    ...FINANCIAL_QUERY_BEHAVIOR,
  });

export const useArchiveCustomerMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      refundDeposit = false,
    }: {
      id: string;
      refundDeposit?: boolean;
    }) =>
      (
        await apiConnector("PATCH", `/customers/${id}/archive`, {
          refundDeposit,
        })
      ).data,
    onSuccess: async (_, { id }) => {
      await invalidateCustomerStatusChanged(queryClient, id);
    },
  });
};

export const useRestoreCustomerMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await apiConnector("PATCH", `/customers/${id}/restore`)).data,
    onSuccess: async (_, id) => {
      await invalidateCustomerStatusChanged(queryClient, id);
    },
  });
};

export const useCreateCustomerMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateCustomerRequest) =>
      (await apiConnector("POST", "/customers", payload)).data,
    onSuccess: async () => {
      await invalidateCustomerCreated(queryClient);
    },
  });
};

export const useUpdateCustomerMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; payload: UpdateCustomerRequest }) =>
      (await apiConnector("PATCH", `/customers/${args.id}`, args.payload)).data,
    onSuccess: async (_, variables) => {
      await invalidateCustomerUpdated(queryClient, variables.id);
    },
  });
};

export type CustomerStatement = {
  depositBalance: number;
  items: {
    date: string;
    type: string;
    reference: string;
    debit: number;
    credit: number;
    balance: number;
  }[];
};

function useDepositMutation(path: "top-up" | "refund") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      amount,
      notes,
    }: {
      id: string;
      amount: number;
      notes?: string;
    }) =>
      (
        await apiConnector("POST", `/customers/${id}/deposits/${path}`, {
          amount,
          notes,
        })
      ).data,
    onSuccess: async (_, { id }) => {
      await invalidateCustomerDepositChanged(queryClient, id);
    },
  });
}

export const useTopUpDepositMutation = () => useDepositMutation("top-up");
export const useRefundDepositMutation = () => useDepositMutation("refund");
