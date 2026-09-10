import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { invalidateCardCollectionChanged } from "./utils/query-invalidation";
import {
  QUERY_GC_TIMES,
  QUERY_REFETCH_INTERVALS,
  QUERY_STALE_TIMES,
  STANDARD_QUERY_BEHAVIOR,
} from "./utils/query-config";
import { apiConnector } from "./utils/apiConnector";

export type CardStatus = "assigned" | "available";

export interface CardCustomerSummaryResponse {
  id: string;
  fullName: string;
  mobileNumber: string;
}

export interface CardAssignmentUserSummaryResponse {
  id: string;
  fullName: string;
}

export interface CardAssignmentSummaryResponse {
  id: string;
  cardId: string;
  customerId: string;
  assignedAt: string;
  unassignedAt: string | null;
  depositAtAssignment: number;
  assignedBy: CardAssignmentUserSummaryResponse;
  customer: CardCustomerSummaryResponse;
}

export interface CardResponse {
  id: string;
  cardNumber: number;
  status: CardStatus;
  createdAt: string;
  currentAssignment: CardAssignmentSummaryResponse | null;
}

export interface CardSummaryResponse {
  totalCards: number;
  assignedCards: number;
  availableCards: number;
}

export interface CardListResponse {
  items: CardResponse[];
  summary: CardSummaryResponse;
}

export interface CardHistoryResponse {
  items: CardAssignmentSummaryResponse[];
}

export interface CardNumberingResponse {
  lastCardNumber: number | null;
  nextCardNumber: number;
}

export interface CreateCardRequest {
  cardNumber: number;
}

const ROOT_KEY = ["cards"] as const;

const LIST_ROOT_KEY = [...ROOT_KEY, "list"] as const;

const AVAILABLE_ROOT_KEY = [...ROOT_KEY, "available"] as const;

const NUMBERING_ROOT_KEY = [...ROOT_KEY, "numbering"] as const;

const HISTORY_ROOT_KEY = [...ROOT_KEY, "history"] as const;

const DETAIL_ROOT_KEY = [...ROOT_KEY, "detail"] as const;

function normalizeAssignment(
  assignment: CardAssignmentSummaryResponse,
): CardAssignmentSummaryResponse {
  return {
    ...assignment,
    assignedAt: new Date(assignment.assignedAt).toISOString(),
    unassignedAt: assignment.unassignedAt
      ? new Date(assignment.unassignedAt).toISOString()
      : null,
  };
}

function normalizeCard(card: CardResponse): CardResponse {
  return {
    ...card,
    createdAt: new Date(card.createdAt).toISOString(),
    currentAssignment: card.currentAssignment
      ? normalizeAssignment(card.currentAssignment)
      : null,
  };
}

function normalizeCardsResponse(response: CardListResponse): CardListResponse {
  return {
    ...response,
    items: response.items.map(normalizeCard),
  };
}

function normalizeHistoryResponse(
  response: CardHistoryResponse,
): CardHistoryResponse {
  return {
    items: response.items.map(normalizeAssignment),
  };
}

export function useCardsQuery() {
  return useQuery({
    queryKey: LIST_ROOT_KEY,

    queryFn: async ({ signal }) => {
      const response = await apiConnector<CardListResponse>(
        "GET",
        "/cards",
        undefined,
        undefined,
        undefined,
        signal,
      );

      return normalizeCardsResponse(response.data);
    },

    staleTime: QUERY_STALE_TIMES.cardsList,
    gcTime: QUERY_GC_TIMES.long,
    refetchInterval: QUERY_REFETCH_INTERVALS.cardsList,
    ...STANDARD_QUERY_BEHAVIOR,
  });
}

export function useAvailableCardsQuery() {
  return useQuery({
    queryKey: AVAILABLE_ROOT_KEY,

    queryFn: async ({ signal }) => {
      const response = await apiConnector<CardListResponse>(
        "GET",
        "/cards/available",
        undefined,
        undefined,
        undefined,
        signal,
      );

      return normalizeCardsResponse(response.data);
    },

    staleTime: QUERY_STALE_TIMES.availableCards,
    gcTime: QUERY_GC_TIMES.standard,
    refetchInterval: QUERY_REFETCH_INTERVALS.availableCards,
    ...STANDARD_QUERY_BEHAVIOR,
  });
}

export function useCardStatsQuery() {
  return useCardsQuery();
}

export function useCardNumberingQuery() {
  return useQuery<CardNumberingResponse>({
    queryKey: NUMBERING_ROOT_KEY,

    queryFn: async ({ signal }) => {
      const response = await apiConnector<CardNumberingResponse>(
        "GET",
        "/cards/numbering",
        undefined,
        undefined,
        undefined,
        signal,
      );

      return response.data;
    },

    staleTime: QUERY_STALE_TIMES.cardNumbering,
    gcTime: QUERY_GC_TIMES.standard,
    ...STANDARD_QUERY_BEHAVIOR,
  });
}

export function useCardQuery(id: string | null | undefined) {
  return useQuery({
    queryKey: [...DETAIL_ROOT_KEY, id ?? ""] as const,

    queryFn: async ({ signal }) => {
      const response = await apiConnector<CardResponse>(
        "GET",
        `/cards/${id}`,
        undefined,
        undefined,
        undefined,
        signal,
      );

      return normalizeCard(response.data);
    },

    enabled: Boolean(id),
    staleTime: QUERY_STALE_TIMES.cardDetail,
    gcTime: QUERY_GC_TIMES.standard,
    ...STANDARD_QUERY_BEHAVIOR,
  });
}

export function useCardHistoryQuery(id: string | null | undefined) {
  return useQuery({
    queryKey: [...HISTORY_ROOT_KEY, id ?? ""] as const,

    queryFn: async ({ signal }) => {
      const response = await apiConnector<CardHistoryResponse>(
        "GET",
        `/cards/${id}/history`,
        undefined,
        undefined,
        undefined,
        signal,
      );

      return normalizeHistoryResponse(response.data);
    },

    enabled: Boolean(id),
    staleTime: QUERY_STALE_TIMES.cardHistory,
    gcTime: QUERY_GC_TIMES.long,
    ...STANDARD_QUERY_BEHAVIOR,
  });
}

export function useCreateCardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateCardRequest) => {
      const response = await apiConnector<CardResponse>("POST", "/cards", {
        body: payload,
      });

      return normalizeCard(response.data);
    },

    onSuccess: async () => {
      await invalidateCardCollectionChanged(queryClient);
    },
  });
}
