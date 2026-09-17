export type CustomerStatus = "active" | "archived";

export type PaymentMethod = "cash" | "upi";

export type BillStatus = "paid" | "partial" | "unpaid";

export type AuditLogType =
  | "customer_created"
  | "customer_updated"
  | "customer_closed"
  | "customer_reopened"
  | "card_assigned"
  | "card_unassigned"
  | "milk_type_changed"
  | "deposit_updated"
  | "entry_added"
  | "entry_updated"
  | "entry_deleted"
  | "bill_generated"
  | "payment_added"
  | "note_added";

export type AuditLogRelatedEntityType =
  "ledger" | "bill" | "payment" | "card" | "cardAssignment" | null;

export interface PageInfo {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/* -------------------------------------------------------------------------- */
/* Customer List                                                              */
/* -------------------------------------------------------------------------- */

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

export type Customer = CustomerResponse;

export interface CustomerListItemResponse extends CustomerResponse {
  primaryMilk: CustomerMilkTypeResponse | null;
}

export interface CustomerListResponse {
  items: CustomerListItemResponse[];
  pageInfo: PageInfo;
}

export interface CustomerListQuery {
  page?: number;
  limit?: number;
  status?: CustomerStatus;
  search?: string;
}

/* -------------------------------------------------------------------------- */
/* Customer Stats                                                             */
/* -------------------------------------------------------------------------- */

export interface CustomerStatsResponse {
  totalActiveCustomers: number;
  totalClosedCustomers: number;
  totalOutstanding: number;
}

/* -------------------------------------------------------------------------- */
/* Customer Detail                                                            */
/* -------------------------------------------------------------------------- */

export interface CustomerDetailCustomerResponse {
  id: string;
  fullName: string;
  mobileNumber: string;
  address: string;
  notes: string;
  status: CustomerStatus;
  depositAmount: number;
  outstandingAmount: number;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDetailCardResponse {
  cardId: string | null;
  cardNumber: number | null;
  assignedAt: string | null;
}

export interface CustomerDetailMilkResponse {
  milkTypeId: string;
  name: string;
  rate: number;
}

export interface CustomerDetailMilkInfoResponse {
  primaryMilk: CustomerDetailMilkResponse | null;
  totalMilkTypes: number;
  otherMilkTypes: CustomerDetailMilkResponse[];
}

export interface CustomerMilkSummaryItem {
  milkTypeId: string;
  milkTypeName: string;
  litres: number;
  rate: number;
  amount: number;
}

export interface CustomerProductSummaryItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface CustomerMonthSummaryResponse {
  month: number;
  year: number;
  totalMilkLitres: number;
  milkSummary: CustomerMilkSummaryItem[];
  productSummary: CustomerProductSummaryItem[];
  otherItemsTotal: number;
  previousDue: number;
  grandTotal: number;
  totalPaid: number;
  outstandingAmount: number;
}

export interface CustomerQuickStatsResponse {
  totalBills: number;
  totalPayments: number;
  lastPaymentAt: string | null;
  lastEntryAt: string | null;
}

export interface CustomerDetailResponse {
  customer: CustomerDetailCustomerResponse;
  card: CustomerDetailCardResponse;
  milkInfo: CustomerDetailMilkInfoResponse;
  currentMonthSummary: CustomerMonthSummaryResponse;
  quickStats: CustomerQuickStatsResponse;
}

/* -------------------------------------------------------------------------- */
/* Daily History                                                              */
/* -------------------------------------------------------------------------- */

export type CustomerDailyHistoryMilkEntry = {
  milkTypeId: string;
  milkTypeName?: string;
  rate?: number;
  litres: number;
  amount?: number;
};

export type CustomerDailyHistoryProductEntry = {
  itemName: string;
  quantity: number;
  unitPrice: number;
  amount?: number;
};

export interface CustomerDailyHistoryEntryResponse {
  createdAt: string;
  createdById: string;
  milkEntries: CustomerDailyHistoryMilkEntry[];
  productEntries: CustomerDailyHistoryProductEntry[];
  notes: string;
  totalAmount: number;
}

export type CustomerDailyHistoryEntry = {
  _id?: string;
  id?: string;

  createdAt?: string;
  createdBy?: {
    id?: string;
    fullName?: string;
  };

  milkEntries?: CustomerDailyHistoryMilkEntry[];
  productEntries?: CustomerDailyHistoryProductEntry[];

  notes?: string;
};

export type CustomerDailyHistoryItemResponse = {
  id: string;
  ledgerDate: string;

  entries: CustomerDailyHistoryEntry[];

  createdAt: string;
  updatedAt: string;
};

export type CustomerDailyHistoryResponse = {
  items: CustomerDailyHistoryItemResponse[];

  pageInfo: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export interface CustomerDailyHistoryQuery {
  month?: number;
  year?: number;
}

/* -------------------------------------------------------------------------- */
/* Bills                                                                      */
/* -------------------------------------------------------------------------- */

export interface CustomerBillItemResponse {
  id: string;
  billNumber: string;
  month: number;
  year: number;
  billDate: string;
  totalMilkLitres: number;
  milkSummary: CustomerMilkSummaryItem[];
  totalItemsCount: number;
  otherItems: CustomerProductSummaryItem[];
  otherItemsTotal: number;
  previousDue: number;
  grandTotal: number;
  totalPaid: number;
  outstandingAmount: number;
  status: BillStatus;
  generatedAt: string;
  generatedBy: string;
}

export interface CustomerBillListResponse {
  items: CustomerBillItemResponse[];
  pageInfo: PageInfo;
}

export interface CustomerBillsQuery {
  page?: number;
  search?: string;
  limit?: number;
}

/* -------------------------------------------------------------------------- */
/* Payments                                                                   */
/* -------------------------------------------------------------------------- */

export interface CustomerPaymentItemResponse {
  id: string;
  customerId: string;
  customer: {
    id: string;
    fullName: string;
    mobileNumber: string;
  };
  billId: string;
  bill: {
    id: string;
    billNumber: string;
    month: number;
    year: number;
    status: string;
    outstandingAmount: number;
  };
  billMonth: number;
  billYear: number;
  receiptNumber: string;
  amount: number;
  depositUsed: number;
  creditedAmount: number;
  paymentMethod: PaymentMethod;
  referenceNumber: string;
  notes: string;
  receivedAt: string;
  receivedBy: {
    id: string;
    fullName: string;
  };
  editedAt: string | null;
  editedBy: {
    id: string;
    fullName: string;
  } | null;
}

export interface CustomerPaymentListResponse {
  items: CustomerPaymentItemResponse[];
  pageInfo: PageInfo;
}

export interface CustomerPaymentsQuery {
  page?: number;
  limit?: number;
  billId?: string;
  billMonth?: number;
  billYear?: number;
  paymentMethod?: PaymentMethod;
  search?: string;
}

/* -------------------------------------------------------------------------- */
/* Audit Logs                                                                 */
/* -------------------------------------------------------------------------- */

export interface CustomerAuditLogItemResponse {
  id: string;
  type: AuditLogType;
  title: string;
  details: Array<{
    field: string;
    oldValue: string;
    newValue: string;
  }>;
  performedBy: {
    id: string;
    fullName: string;
  };
  performedAt: string;
  relatedEntityType: AuditLogRelatedEntityType;
  relatedEntityId: string | null;
}

export interface CustomerAuditLogResponse {
  items: CustomerAuditLogItemResponse[];
  pageInfo: PageInfo;
}

export interface CustomerAuditLogsQuery {
  page?: number;
  limit?: number;
}

/* -------------------------------------------------------------------------- */
/* Card                                                                       */
/* -------------------------------------------------------------------------- */

export interface CustomerCardAssignmentResponse {
  id: string;
  cardId: string;
  customerId: string;
  assignedAt: string;
  unassignedAt: string | null;
  depositAtAssignment: number;
  assignedBy: {
    id: string;
    fullName: string;
  };
  customer: {
    id: string;
    fullName: string;
    mobileNumber: string;
  };
}

export interface CustomerCardAssignmentSummaryResponse {
  id: string;
  cardId: string;
  cardNumber: number | null;
  customerId: string;
  customer: {
    id: string;
    fullName: string;
    mobileNumber: string;
  };
  assignedAt: string;
  unassignedAt: string | null;
  depositAtAssignment: number;
  assignedBy: {
    id: string;
    fullName: string;
  };
}

export interface CustomerCardHistoryResponse {
  items: CustomerCardAssignmentResponse[];
}

/* -------------------------------------------------------------------------- */
/* Create / Update                                                            */
/* -------------------------------------------------------------------------- */

export interface CreateCustomerRequest {
  fullName: string;
  mobileNumber?: string | undefined;
  address: string;
  depositAmount: number;
  primaryMilkTypeId: string;
  otherMilkTypeIds?: string[];
  cardNumber: number;
  notes?: string;
}

export interface UpdateCustomerRequest {
  fullName: string;
  mobileNumber?: string | undefined;
  address: string;
  depositAmount?: number;
  primaryMilkTypeId?: string;
  otherMilkTypeIds?: string[];
  cardNumber: number;
  notes?: string;
}

export interface CustomerIdParams {
  id: string;
}
