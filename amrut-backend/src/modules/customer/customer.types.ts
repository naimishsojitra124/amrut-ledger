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
  mobileNumber: string;
  address: string;
  depositAmount?: number;
  primaryMilkTypeId: string;
  otherMilkTypeIds?: string[] | undefined;
  cardNumber?: number;
  notes?: string | undefined;
}

export interface UpdateCustomerRequest {
  fullName?: string;
  mobileNumber?: string;
  address?: string;
  depositAmount?: number | undefined;
  primaryMilkTypeId?: string | undefined;
  otherMilkTypeIds?: string[] | undefined;
  cardNumber?: number;
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

export interface CustomerBillListResponse extends BillListResponse {}
export interface CustomerPaymentListResponse extends PaymentListResponse {}
