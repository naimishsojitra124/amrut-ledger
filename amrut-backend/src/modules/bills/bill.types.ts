import type { BillStatus, PaymentMethod } from "../../../generated/prisma/enums";

export interface PageInfo {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface BillMilkSummaryResponse {
  milkTypeId: string;
  milkTypeName: string;
  litres: number;
  rate: number;
  amount: number;
}

export interface BillProductSummaryResponse {
  productSuggestionId: string | null;
  itemName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface BillCustomerSummaryResponse {
  id: string;
  fullName: string;
  mobileNumber: string;
}

export interface BillCardAssignmentSummaryResponse {
  id: string;
  cardId: string;
  cardNumber: number | null;
  assignedAt: string;
  unassignedAt: string | null;
  depositAtAssignment: number;
}

export interface BillUserSummaryResponse {
  id: string;
  fullName: string;
}

export interface BillPaymentSummaryResponse {
  count: number;
  totalAmount: number;
}

export interface BillListItemResponse {
  id: string;
  billNumber: string;
  customerId: string;
  customer: BillCustomerSummaryResponse;
  cardAssignment: BillCardAssignmentSummaryResponse;
  month: number;
  year: number;
  billDate: string;
  totalMilkLitres: number;
  totalItemsCount: number;
  otherItemsTotal: number;
  previousDue: number;
  grandTotal: number;
  totalPaid: number;
  outstandingAmount: number;
  status: BillStatus;
  billVersion: number;
  generatedAt: string;
}

export interface BillResponse extends BillListItemResponse {
  generatedBy: BillUserSummaryResponse;
  milkSummary: BillMilkSummaryResponse[];
  otherItems: BillProductSummaryResponse[];
  notes: string | null;
  paymentSummary: BillPaymentSummaryResponse;
}

export interface BillListResponse {
  items: BillListItemResponse[];
  pageInfo: PageInfo;
}

export interface BillSummaryResponse {
  totalBills: number;
  paidBills: number;
  partialBills: number;
  unpaidBills: number;
  totalMilkLitres: number;
  totalItemsCount: number;
  otherItemsTotal: number;
  grandTotal: number;
  totalPaid: number;
  outstandingAmount: number;
}

export interface BillListQuery {
  page?: number | undefined;
  limit?: number | undefined;
  customerId?: string | undefined;
  month?: number | undefined;
  year?: number | undefined;
  status?: BillStatus | undefined;
  search?: string | undefined;
}

export interface BillIdParams {
  billId: string;
}

export interface CustomerIdParams {
  customerId: string;
}

export interface CustomerBillMonthParams {
  customerId: string;
  year: number;
  month: number;
}

export interface PaymentCustomerSummaryResponse {
  id: string;
  fullName: string;
  mobileNumber: string;
}

export interface PaymentBillSummaryResponse {
  id: string;
  billNumber: string;
  month: number;
  year: number;
  status: BillStatus;
  outstandingAmount: number;
}

export interface PaymentUserSummaryResponse {
  id: string;
  fullName: string;
}

export interface PaymentListItemResponse {
  id: string;
  customerId: string;
  customer: PaymentCustomerSummaryResponse;
  billId: string;
  bill: PaymentBillSummaryResponse;
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
  receivedBy: PaymentUserSummaryResponse;
  editedAt: string | null;
  editedBy: PaymentUserSummaryResponse | null;
}

export interface PaymentResponse extends PaymentListItemResponse {}

export interface PaymentListResponse {
  items: PaymentListItemResponse[];
  pageInfo: PageInfo;
}

export interface PaymentSummaryResponse {
  totalPayments: number;
  totalAmount: number;
  cashCount: number;
  cashAmount: number;
  upiCount: number;
  upiAmount: number;
  latestPaymentAt: string | null;
}

export interface PaymentListQuery {
  page?: number | undefined;
  limit?: number | undefined;
  customerId?: string | undefined;
  billId?: string | undefined;
  billMonth?: number | undefined;
  billYear?: number | undefined;
  paymentMethod?: PaymentMethod | undefined;
  search?: string | undefined;
}

export interface PaymentIdParams {
  paymentId: string;
}

export interface BillPaymentsParams {
  billId: string;
}

export interface CustomerPaymentsParams {
  customerId: string;
}

export interface GenerateBillRequest {
  month: number;
  year: number;
}

export interface CreatePaymentRequest {
  clientRequestId: string;
  billId: string;
  amount: number;
  useDeposit: boolean;
  paymentMethod: PaymentMethod;
  referenceNumber?: string | undefined;
  notes?: string | undefined;
}
