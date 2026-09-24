import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import axios, { type Method } from "axios";

import {
  invalidateBillGenerated,
  invalidatePaymentRecorded,
} from "./utils/query-invalidation";
import {
  FINANCIAL_QUERY_BEHAVIOR,
  QUERY_GC_TIMES,
  QUERY_STALE_TIMES,
} from "./utils/query-config";
import { apiConnector, cleanParams } from "./utils/apiConnector";
import { paymentQueue } from "./offline-payment-queue.service";

import type {
  BillListQuery,
  BillListResponse,
  BillResponse,
  BillSummaryResponse,
  CreatePaymentRequest,
  GenerateBillRequest,
  PaymentListQuery,
  PaymentListResponse,
  PaymentResponse,
} from "@/types/bill";

const BILL_ROOT = ["bills"] as const;
const BILL_LIST_ROOT = [...BILL_ROOT, "list"] as const;
const BILL_SUMMARY_ROOT = [...BILL_ROOT, "summary"] as const;
const BILL_DETAIL_ROOT = [...BILL_ROOT, "detail"] as const;

const PAYMENT_ROOT = ["payments"] as const;
const PAYMENT_LIST_ROOT = [...PAYMENT_ROOT, "list"] as const;
const PAYMENT_DETAIL_ROOT = [...PAYMENT_ROOT, "detail"] as const;

async function request<T>(
  method: Method,
  url: string,
  options: {
    body?: unknown;
    params?: Record<string, unknown>;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const response = await apiConnector<T>(
    method,
    url,
    options.body,
    undefined,
    options.params,
    options.signal,
  );

  return response.data;
}

export const billQueryKeys = {
  all: BILL_ROOT,

  listRoot: () => BILL_LIST_ROOT,

  list: (query: BillListQuery = {}) =>
    [
      ...BILL_LIST_ROOT,
      {
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        customerId: query.customerId ?? null,
        month: query.month ?? null,
        year: query.year ?? null,
        status: query.status ?? null,
        search: query.search?.trim() ?? "",
      },
    ] as const,

  summary: (query: BillListQuery = {}) =>
    [
      ...BILL_SUMMARY_ROOT,
      {
        customerId: query.customerId ?? null,
        month: query.month ?? null,
        year: query.year ?? null,
        status: query.status ?? null,
        search: query.search?.trim() ?? "",
      },
    ] as const,

  detail: (billId: string) => [...BILL_DETAIL_ROOT, billId] as const,
};

export const paymentQueryKeys = {
  detail: (paymentId: string) => [...PAYMENT_DETAIL_ROOT, paymentId] as const,
};

export async function getBills(
  query: BillListQuery = {},
  signal?: AbortSignal,
): Promise<BillListResponse> {
  return request<BillListResponse>("GET", "/bills", {
    params: cleanParams({
      page: query.page,
      limit: query.limit,
      customerId: query.customerId,
      month: query.month,
      year: query.year,
      status: query.status,
      search: query.search?.trim(),
    }),
    signal,
  });
}

export async function getBillsSummary(
  query: BillListQuery = {},
  signal?: AbortSignal,
): Promise<BillSummaryResponse> {
  return request<BillSummaryResponse>("GET", "/bills/summary", {
    params: cleanParams({
      customerId: query.customerId,
      month: query.month,
      year: query.year,
      status: query.status,
      search: query.search?.trim(),
    }),
    signal,
  });
}

export async function getBillById(
  billId: string,
  signal?: AbortSignal,
): Promise<BillResponse> {
  return request<BillResponse>("GET", `/bills/${billId}`, { signal });
}

export async function getBillPayments(
  billId: string,
  query: PaymentListQuery = {},
  signal?: AbortSignal,
): Promise<PaymentListResponse> {
  return request<PaymentListResponse>("GET", `/bills/${billId}/payments`, {
    params: cleanParams({
      page: query.page,
      limit: query.limit,
      search: query.search?.trim(),
      paymentMethod: query.paymentMethod,
    }),
    signal,
  });
}

export async function generateBill(
  customerId: string,
  payload: GenerateBillRequest,
): Promise<BillResponse> {
  return request<BillResponse>("POST", `/customers/${customerId}/bills`, {
    body: payload,
  });
}

export async function recordPayment(
  payload: CreatePaymentRequest,
): Promise<PaymentResponse> {
  return request<PaymentResponse>("POST", "/payments", {
    body: {
      ...payload,
      clientRequestId: payload.clientRequestId ?? crypto.randomUUID(),
    },
  });
}

export const useBillsQuery = (query: BillListQuery = {}) =>
  useQuery({
    queryKey: billQueryKeys.list(query),

    queryFn: ({ signal }) => getBills(query, signal),

    staleTime: QUERY_STALE_TIMES.billsList,
    gcTime: QUERY_GC_TIMES.standard,
    refetchInterval: 5 * 60_000 + 15_000,
    ...FINANCIAL_QUERY_BEHAVIOR,
    placeholderData: keepPreviousData,
  });

export const useBillsSummaryQuery = (query: BillListQuery = {}) =>
  useQuery({
    queryKey: billQueryKeys.summary(query),

    queryFn: ({ signal }) => getBillsSummary(query, signal),

    staleTime: QUERY_STALE_TIMES.billsSummary,
    gcTime: QUERY_GC_TIMES.standard,
    refetchInterval: 5 * 60_000 + 30_000,
    ...FINANCIAL_QUERY_BEHAVIOR,
  });

export const useBillQuery = (billId: string | null) =>
  useQuery({
    queryKey: billQueryKeys.detail(billId ?? ""),

    queryFn: ({ signal }) => {
      if (!billId) {
        throw new Error("Bill id is required");
      }

      return getBillById(billId, signal);
    },

    enabled: Boolean(billId),
    staleTime: QUERY_STALE_TIMES.billDetail,
    gcTime: QUERY_GC_TIMES.standard,
    ...FINANCIAL_QUERY_BEHAVIOR,
  });

export const useBillPaymentsQuery = (
  billId: string | null,
  query: PaymentListQuery = {},
) =>
  useQuery({
    queryKey: [
      ...PAYMENT_LIST_ROOT,
      "bill",
      billId,
      {
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        search: query.search?.trim() ?? "",
        paymentMethod: query.paymentMethod ?? null,
      },
    ] as QueryKey,

    queryFn: ({ signal }) => {
      if (!billId) {
        throw new Error("Bill id is required");
      }

      return getBillPayments(billId, query, signal);
    },

    enabled: Boolean(billId),
    staleTime: QUERY_STALE_TIMES.billPayments,
    gcTime: QUERY_GC_TIMES.standard,
    ...FINANCIAL_QUERY_BEHAVIOR,
    placeholderData: keepPreviousData,
  });

export const useGenerateBillMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      customerId,
      month,
      year,
    }: {
      customerId: string;
      month: number;
      year: number;
    }) =>
      generateBill(customerId, {
        month,
        year,
      }),

    onSuccess: async (bill, variables) => {
      queryClient.setQueryData(billQueryKeys.detail(bill.id), bill);

      await invalidateBillGenerated(queryClient, variables.customerId, bill.id);
    },
  });
};

export const useRecordPaymentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreatePaymentRequest) => {
      const request = {
        ...payload,
        clientRequestId: payload.clientRequestId ?? crypto.randomUUID(),
      };

      if (!navigator.onLine) {
        paymentQueue.add(request);

        return {
          queued: true,
        } as const;
      }

      try {
        return await recordPayment(request);
      } catch (error) {
        if (axios.isAxiosError(error) && !error.response) {
          paymentQueue.add(request);

          return {
            queued: true,
          } as const;
        }

        throw error;
      }
    },

    onSuccess: async (payment) => {
      if ("queued" in payment) {
        return;
      }

      queryClient.setQueryData(paymentQueryKeys.detail(payment.id), payment);

      await invalidatePaymentRecorded(
        queryClient,
        payment.customerId,
        payment.billId,
      );
    },
  });
};
