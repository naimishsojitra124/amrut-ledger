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
  /** Stable identifier. Edits and deletions address this, never the index. */
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
