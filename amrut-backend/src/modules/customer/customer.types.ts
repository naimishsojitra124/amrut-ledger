import type {
  BillStatus,
  CustomerStatus,
  PaymentMethod,
  AuditLogType,
  AuditRelatedEntityType,
} from "../../../generated/prisma/enums";
import type { BillListResponse, PaymentListResponse } from "../bills/bill.types";
import type { CardAssignmentSummaryResponse } from "../cards/card.types";

export interface PageInfo {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface CustomerMilkTypeResponse {
  milkTypeId: string;
  milkTypeName: string;
  shortCode: string;
  rate: number;
  isDefault: boolean;
}

export interface CustomerCardResponse {
  cardId: string;
  cardNumber: number;
  status: "assigned" | "available";
  assignedAt: string;
  unassignedAt: string | null;
  depositAtAssignment: number;
}

export interface CustomerResponse {
  id: string;
  fullName: string;
  searchName: string;
  mobileNumber: string;
  address: string;
  depositAmount: number;
  status: CustomerStatus;
  milkTypes: CustomerMilkTypeResponse[];
  currentCard: CustomerCardResponse | null;
  outstandingAmount: number;
  lastEntryAt: string | null;
  notes: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerListResponse {
  items: CustomerResponse[];
  pageInfo: PageInfo;
}

export interface CustomerStatsResponse {
  totalActiveCustomers: number;
  totalClosedCustomers: number;
  totalOutstanding: number;
  totalCustomers: number;
  activeCustomers: number;
  archivedCustomers: number;
  customersWithCard: number;
  customersWithoutCard: number;
  totalDepositAmount: number;
}

export interface CreateCustomerRequest {
  fullName: string;
  mobileNumber?: string | undefined;
  address?: string | undefined;
  depositAmount?: number;
  primaryMilkTypeId: string;
  otherMilkTypeIds?: string[] | undefined;
  cardNumber?: number;
  notes?: string | undefined;
  /** Balance already owed from before this system was in use. */
  openingBalance?: OpeningBalanceInput | undefined;
}

/**
 * The balance a customer was already carrying before the shop moved onto this
 * system. Stored as a bill so that payments, carry-forward and every
 * outstanding total treat it like any other receivable.
 */
export interface OpeningBalanceInput {
  amount: number;
  month: number;
  year: number;
  notes?: string | undefined;
}

export interface OpeningBalanceResponse {
  id: string;
  billNumber: string;
  month: number;
  year: number;
  amount: number;
  totalPaid: number;
  outstandingAmount: number;
  status: string;
  notes: string;
  recordedAt: string;
  carriedForwardToBillId: string | null;
}

export interface UpdateCustomerRequest {
  fullName?: string | undefined;
  /** Omitted leaves the number unchanged; an empty string clears it. */
  mobileNumber?: string | undefined;
  address?: string | undefined;
  depositAmount?: number | undefined;
  primaryMilkTypeId?: string | undefined;
  otherMilkTypeIds?: string[] | undefined;
  cardNumber?: number | undefined;
  notes?: string | undefined;
}

export interface CustomerListQuery {
  page?: number;
  limit?: number;
  status?: CustomerStatus | undefined;
  search?: string | undefined;
}

export interface CustomerIdParams {
  id: string;
}

export interface CustomerDailyHistoryItemResponse {
  id: string;
  ledgerDate: string;
  entries: unknown[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerBillSummaryResponse {
  totalBills: number;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
}

export interface CustomerPaymentSummaryResponse {
  totalPayments: number;
  totalPaid: number;
  totalBilled: number;
  outstanding: number;
  lastPaymentAt: string | null;
  outstandingBillCount: number;
}

export interface CustomerNextOutstandingBillResponse {
  id: string;
  billNumber: string;
  month: number;
  year: number;
  outstandingAmount: number;
}

export interface CustomerDailyHistoryResponse {
  items: CustomerDailyHistoryItemResponse[];
  pageInfo: PageInfo;
}

export interface CustomerAuditLogItemResponse {
  id: string;
  type: AuditLogType;
  title: string;
  details: { field: string; oldValue: string; newValue: string }[];
  performedBy: { id: string; fullName: string };
  performedAt: string;
  relatedEntityType: AuditRelatedEntityType | null;
  relatedEntityId: string | null;
}

export interface CustomerAuditLogResponse {
  items: CustomerAuditLogItemResponse[];
  pageInfo: PageInfo;
}

export interface CustomerCardAssignmentResponse extends CardAssignmentSummaryResponse {}

export interface CustomerBillListResponse extends BillListResponse {
  summary: CustomerBillSummaryResponse;
}

export interface CustomerPaymentListResponse extends PaymentListResponse {
  summary: CustomerPaymentSummaryResponse;
  nextOutstandingBill: CustomerNextOutstandingBillResponse | null;
}
