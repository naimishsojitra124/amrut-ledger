import type { UserStatus } from "../../../generated/prisma/enums";

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

export interface CreateDailyLedgerRequest {
  notes?: string | undefined;
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
  status: UserStatus;
}

export interface DailyLedgerEntryResponse {
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

export interface DailyLedgerListItemResponse {
  id: string;
  customerId: string;
  customer: DailyLedgerCustomerSummaryResponse;
  cardAssignmentId: string;
  cardAssignment: DailyLedgerCardSummaryResponse;
  ledgerDate: string;
  entryCount: number;
  totalMilkLitres: number;
  totalMilkAmount: number;
  totalProductAmount: number;
  grandTotal: number;
  updatedAt: string;
}

export interface DailyLedgerListResponse {
  items: DailyLedgerListItemResponse[];
  pageInfo: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface DailyLedgerSummaryResponse {
  totalLedgers: number;
  totalEntries: number;
  totalMilkLitres: number;
  totalMilkAmount: number;
  totalProductAmount: number;
  grandTotal: number;
}

export interface DailyLedgerListQuery {
  page: number;
  limit: number;
  month?: number | undefined;
  year?: number | undefined;
}

export interface DailyLedgerDateParams {
  customerId: string;
  date: string;
}

export interface DailyLedgerCustomerParams {
  customerId: string;
}

export interface DailyLedgerEntryIndexParams {
  customerId: string;
  date: string;
  entryIndex: number;
}
