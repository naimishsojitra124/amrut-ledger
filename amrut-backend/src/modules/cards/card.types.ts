import type { CardStatus } from "../../../generated/prisma/enums";

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

export interface CardListPageInfo {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface CardListResponse {
  items: CardResponse[];
  /** Counted across all cards, so the totals do not change as you filter. */
  summary: CardSummaryResponse;
  pageInfo: CardListPageInfo;
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

export interface UpdateCardRequest {
  cardNumber: number;
}

export interface AssignCardRequest {
  customerId: string;
  depositAtAssignment?: number;
  assignedAt?: Date;
}

export interface CardListQuery {
  status?: CardStatus | undefined;
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface CardIdParams {
  id: string;
}

export interface CustomerIdParams {
  customerId: string;
}

export interface CardAssignmentParams {
  cardId: string;
}