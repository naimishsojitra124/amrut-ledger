import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import { invalidateCustomerLedgerChanged } from "./utils/query-invalidation";
import {
  FINANCIAL_QUERY_BEHAVIOR,
  QUERY_GC_TIMES,
  QUERY_STALE_TIMES,
} from "./utils/query-config";
import { apiConnector } from "./utils/apiConnector";

export interface DailyLedgerMilkEntryRequest {
  milkTypeId: string;
  litres: number;
}

export interface DailyLedgerProductEntryRequest {
  productSuggestionId?: string | null | undefined;
  itemName: string;
  quantity: number;
  unitPrice: number;
}

export interface AddDailyLedgerEntryRequest {
  clientRequestId?: string | undefined;
  milkEntries?: DailyLedgerMilkEntryRequest[] | undefined;
  productEntries?: DailyLedgerProductEntryRequest[] | undefined;
  notes?: string | undefined;
}

export interface UpdateDailyLedgerEntryRequest {
  milkEntries?: DailyLedgerMilkEntryRequest[] | undefined;
  productEntries?: DailyLedgerProductEntryRequest[] | undefined;
  notes?: string | undefined;
}

export interface DailyLedgerMilkEntryResponse {
  milkTypeId: string;
  milkTypeName: string;
  rate: number;
  litres: number;
  amount: number;
}

export interface DailyLedgerProductEntryResponse {
  productSuggestionId: string | null;
  itemName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface DailyLedgerUserSummaryResponse {
  id: string;
  fullName: string;
  status: "active" | "inactive";
}

export interface DailyLedgerEntryResponse {
  id: string;
  entryIndex: number;
  createdAt: string;
  createdBy: DailyLedgerUserSummaryResponse;
  milkEntries: DailyLedgerMilkEntryResponse[];
  productEntries: DailyLedgerProductEntryResponse[];
  notes: string;
  totalAmount: number;
}

export interface DailyLedgerCustomerSummaryResponse {
  id: string;
  fullName: string;
  mobileNumber: string;
}

export interface DailyLedgerCardSummaryResponse {
  id: string;
  cardId: string;
  cardNumber: number | null;
  assignedAt: string;
  unassignedAt: string | null;
  depositAtAssignment: number;
}

export interface DailyLedgerResponse {
  id: string;
  customerId: string;
  customer: DailyLedgerCustomerSummaryResponse;
  cardAssignmentId: string;
  cardAssignment: DailyLedgerCardSummaryResponse;
  ledgerDate: string;
  entries: DailyLedgerEntryResponse[];
  // Someone confirmed the customer bought nothing that day, as opposed to nobody
  // having reached the day yet.
  noPurchase: boolean;
  totalMilkLitres: number;
  totalMilkAmount: number;
  totalProductAmount: number;
  grandTotal: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: DailyLedgerUserSummaryResponse;
}

function mapEntry(entry: DailyLedgerEntryResponse) {
  return {
    ...entry,
    createdAt: new Date(entry.createdAt).toISOString(),
  };
}

function mapLedger(ledger: DailyLedgerResponse): DailyLedgerResponse {
  return {
    ...ledger,
    ledgerDate: new Date(ledger.ledgerDate).toISOString(),
    createdAt: new Date(ledger.createdAt).toISOString(),
    updatedAt: new Date(ledger.updatedAt).toISOString(),
    entries: ledger.entries.map(mapEntry),
  };
}

const ROOT_KEY = ["daily-ledgers"] as const;

export interface LastLedgerEntryResponse {
  ledgerDate: string;
  cardNumber: number | null;
  customerId: string;
  customerName: string;
  recordedAt: string;
  recordedBy: { id: string; fullName: string; status: string } | null;
  noPurchase: boolean;
}

export interface DailyLedgerNoPurchaseResponse {
  customerId: string;
  ledgerDate: string;
  noPurchase: boolean;
  ledger: DailyLedgerResponse | null;
}

export const LAST_LEDGER_ENTRY_KEY = [...ROOT_KEY, "last-entry"] as const;

// Exported so the realtime cache layer writes to exactly the keys the hooks read.
export function dailyLedgerQueryKey(customerId: string, date: string) {
  return [...ROOT_KEY, customerId, date] as const;
}

export { mapLedger };

// Where data entry got to, across every customer, so the next person knows
// which card and date to carry on from.
export function useLastLedgerEntryQuery(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: LAST_LEDGER_ENTRY_KEY,

    queryFn: async ({ signal }) => {
      const response = await apiConnector<LastLedgerEntryResponse | null>(
        "GET",
        "/ledgers/last-entry",
        undefined,
        undefined,
        undefined,
        signal,
      );

      return response.data ?? null;
    },

    enabled: options.enabled ?? true,
    staleTime: QUERY_STALE_TIMES.dailyLedger,
    gcTime: QUERY_GC_TIMES.standard,
    ...FINANCIAL_QUERY_BEHAVIOR,
  });
}

export function useCustomerDailyLedgerQuery(
  customerId: string | null | undefined,
  date: string | null | undefined,
) {
  return useQuery({
    queryKey: [...ROOT_KEY, customerId ?? "", date ?? ""] as const,

    queryFn: async ({ signal }) => {
      if (!customerId || !date) {
        return null;
      }

      try {
        const response = await apiConnector<DailyLedgerResponse>(
          "GET",
          `/customers/${customerId}/ledgers/${date}`,
          undefined,
          undefined,
          undefined,
          signal,
        );

        return mapLedger(response.data);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return null;
        }

        throw error;
      }
    },

    enabled: Boolean(customerId && date),

    staleTime: QUERY_STALE_TIMES.dailyLedger,
    gcTime: QUERY_GC_TIMES.standard,
    ...FINANCIAL_QUERY_BEHAVIOR,
    placeholderData: (previous) => previous,
  });
}

export function useAddDailyLedgerEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: {
      customerId: string;
      date: string;
      payload: AddDailyLedgerEntryRequest;
    }) =>
      addDailyLedgerEntry(
        variables.customerId,
        variables.date,
        variables.payload,
      ),

    onSuccess: async (ledger, variables) => {
      const queryKey = [
        ...ROOT_KEY,
        variables.customerId,
        variables.date,
      ] as const;

      queryClient.setQueryData(queryKey, ledger);

      await invalidateCustomerLedgerChanged(queryClient, variables.customerId);
    },
  });
}

export async function addDailyLedgerEntry(
  customerId: string,
  date: string,
  payload: AddDailyLedgerEntryRequest,
) {
  const response = await apiConnector<DailyLedgerResponse>(
    "POST",
    `/customers/${customerId}/ledgers/${date}/entries`,
    payload,
  );

  return mapLedger(response.data);
}

export function useUpdateDailyLedgerEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: {
      customerId: string;
      date: string;
      entryId: string;
      payload: UpdateDailyLedgerEntryRequest;
    }) => {
      const response = await apiConnector<DailyLedgerResponse>(
        "PATCH",
        `/customers/${variables.customerId}/ledgers/${variables.date}/entries/${variables.entryId}`,
        variables.payload,
      );

      return mapLedger(response.data);
    },

    onSuccess: async (ledger, variables) => {
      const queryKey = [
        ...ROOT_KEY,
        variables.customerId,
        variables.date,
      ] as const;

      queryClient.setQueryData(queryKey, ledger);

      await invalidateCustomerLedgerChanged(queryClient, variables.customerId);
    },
  });
}

export function useDeleteDailyLedgerEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: {
      customerId: string;
      date: string;
      entryId: string;
    }) => {
      const response = await apiConnector<DailyLedgerResponse>(
        "DELETE",
        `/customers/${variables.customerId}/ledgers/${variables.date}/entries/${variables.entryId}`,
      );

      return mapLedger(response.data);
    },

    onSuccess: async (ledger, variables) => {
      const queryKey = [
        ...ROOT_KEY,
        variables.customerId,
        variables.date,
      ] as const;

      queryClient.setQueryData(queryKey, ledger);

      await invalidateCustomerLedgerChanged(queryClient, variables.customerId);
    },
  });
}

// Records that the customer was reached on this day and bought nothing, so the round
// can be continued without leaving a gap that looks like unentered work.
export function useSetNoPurchaseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: {
      customerId: string;
      date: string;
      noPurchase: boolean;
    }) => {
      const response = await apiConnector<DailyLedgerNoPurchaseResponse>(
        "PATCH",
        `/customers/${variables.customerId}/ledgers/${variables.date}/no-purchase`,
        { noPurchase: variables.noPurchase },
      );

      return response.data;
    },

    onSuccess: async (result, variables) => {
      const queryKey = dailyLedgerQueryKey(variables.customerId, variables.date);

      if (result.ledger) {
        queryClient.setQueryData(queryKey, mapLedger(result.ledger));
      } else {
        queryClient.removeQueries({ queryKey });
      }

      await invalidateCustomerLedgerChanged(queryClient, variables.customerId);
    },
  });
}
