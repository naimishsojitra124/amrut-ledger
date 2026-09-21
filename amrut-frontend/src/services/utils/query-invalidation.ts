import type { QueryClient } from "@tanstack/react-query";

import type { RealtimeChangeEvent, RealtimeResource } from "@/services/realtime/realtime.types";

const ROOTS = {
  customers: ["customers"] as const,
  customerList: ["customers", "list"] as const,
  customerStats: ["customers", "stats"] as const,
  customerDetail: ["customers", "detail"] as const,
  customerDailyHistory: ["customers", "daily-history"] as const,
  customerBills: ["customers", "bills"] as const,
  customerPayments: ["customers", "payments"] as const,
  customerAuditLogs: ["customers", "audit-logs"] as const,
  customerStatement: ["customers", "statement"] as const,
  customerOpeningBalance: ["customers", "opening-balance"] as const,

  bills: ["bills"] as const,
  billList: ["bills", "list"] as const,
  billSummary: ["bills", "summary"] as const,
  billDetail: ["bills", "detail"] as const,
  overdueBills: ["bills", "overdue"] as const,

  payments: ["payments"] as const,
  paymentList: ["payments", "list"] as const,
  paymentSummary: ["payments", "summary"] as const,
  paymentDetail: ["payments", "detail"] as const,

  dailyLedgers: ["daily-ledgers"] as const,
  ledgerLastEntry: ["daily-ledgers", "last-entry"] as const,

  cards: ["cards"] as const,
  cardList: ["cards", "list"] as const,
  availableCards: ["cards", "available"] as const,
  cardNumbering: ["cards", "numbering"] as const,
  cardDetail: ["cards", "detail"] as const,
  cardHistory: ["cards", "history"] as const,

  functionOrders: ["function-orders"] as const,
  functionOrderList: ["function-orders", "list"] as const,
  functionOrderAuditLogs: ["function-orders", "audit-logs"] as const,
  functionOrderReminders: ["function-orders", "reminders"] as const,

  productSuggestions: ["product-suggestions"] as const,

  milkTypes: ["milk-types"] as const,

  users: ["users"] as const,

  systemJobs: ["system-jobs"] as const,
} as const;

async function invalidate(
  queryClient: QueryClient,
  queryKeys: readonly (readonly unknown[])[],
) {
  await Promise.all(
    queryKeys.map((queryKey) =>
      queryClient.invalidateQueries({
        queryKey,
      }),
    ),
  );
}

export async function invalidateCustomerCreated(queryClient: QueryClient) {
  return invalidate(queryClient, [
    ROOTS.customerList,
    ROOTS.customerStats,
    ROOTS.availableCards,
    ROOTS.cardNumbering
  ]);
}

// A receivable, so it moves the customer's outstanding total and every bill aggregate.
export async function invalidateOpeningBalanceChanged(
  queryClient: QueryClient,
  customerId: string,
) {
  return invalidate(queryClient, [
    [...ROOTS.customerOpeningBalance, customerId],
    [...ROOTS.customerDetail, customerId],
    [...ROOTS.customerBills, customerId],
    [...ROOTS.customerStatement, customerId],
    ROOTS.customerList,
    ROOTS.customerStats,
    ROOTS.bills,
    ROOTS.overdueBills,
  ]);
}

export async function invalidateCustomerUpdated(
  queryClient: QueryClient,
  customerId: string,
) {
  return invalidate(queryClient, [
    ROOTS.customerList,
    [...ROOTS.customerDetail, customerId],
    ROOTS.availableCards,
  ]);
}

// Archive/restore changes list membership/status and customer statistics.
export async function invalidateCustomerStatusChanged(
  queryClient: QueryClient,
  customerId: string,
) {
  return invalidate(queryClient, [
    ROOTS.customerList,
    ROOTS.customerStats,
    [...ROOTS.customerDetail, customerId],
    ROOTS.availableCards,
  ]);
}

// The ledger cache is written directly; these dependants only need refreshing.
export async function invalidateCustomerLedgerChanged(
  queryClient: QueryClient,
  customerId: string,
) {
  return invalidate(queryClient, [
    ROOTS.customerList,
    [...ROOTS.customerDetail, customerId],
    [...ROOTS.customerDailyHistory, customerId],
    [...ROOTS.customerBills, customerId],
    [...ROOTS.customerStatement, customerId],
    ROOTS.ledgerLastEntry,
  ]);
}

export async function invalidateBillGenerated(
  queryClient: QueryClient,
  customerId: string,
  billId: string,
) {
  return invalidate(queryClient, [
    ROOTS.billList,
    ROOTS.billSummary,
    [...ROOTS.billDetail, billId],
    ROOTS.customerList,
    ROOTS.customerStats,
    [...ROOTS.customerDetail, customerId],
    [...ROOTS.customerBills, customerId],
    [...ROOTS.customerStatement, customerId],
  ]);
}

export async function invalidatePaymentRecorded(
  queryClient: QueryClient,
  customerId: string,
  billId: string,
) {
  return invalidate(queryClient, [
    ROOTS.billList,
    ROOTS.billSummary,
    [...ROOTS.billDetail, billId],

    ROOTS.paymentList,
    ROOTS.paymentSummary,
    [...ROOTS.paymentDetail],

    [...ROOTS.customerDetail, customerId],
    [...ROOTS.customerBills, customerId],
    [...ROOTS.customerPayments, customerId],
    [...ROOTS.customerStatement, customerId],
    ROOTS.customerList,
    ROOTS.customerStats,

    [...ROOTS.payments, "list", "bill", billId],
  ]);
}

export async function invalidateCustomerDepositChanged(
  queryClient: QueryClient,
  customerId: string,
) {
  return invalidate(queryClient, [
    ROOTS.customerList,
    [...ROOTS.customerDetail, customerId],
    [...ROOTS.customerStatement, customerId],
  ]);
}

export async function invalidateCardCollectionChanged(
  queryClient: QueryClient,
) {
  return invalidate(queryClient, [
    ROOTS.cardList,
    ROOTS.availableCards,
    ROOTS.cardNumbering,
  ]);
}

export async function invalidateCardChanged(
  queryClient: QueryClient,
  cardId: string,
) {
  return invalidate(queryClient, [
    ROOTS.cardList,
    ROOTS.availableCards,
    [...ROOTS.cardDetail, cardId],
    [...ROOTS.cardHistory, cardId],
  ]);
}

export async function invalidateFunctionOrdersChanged(
  queryClient: QueryClient,
  functionOrderId?: string,
) {
  const keys: readonly (readonly unknown[])[] = [
    ROOTS.functionOrderList,
    ROOTS.functionOrderReminders,
  ];

  if (functionOrderId) {
    return invalidate(queryClient, [
      ...keys,
      [...ROOTS.functionOrderAuditLogs, functionOrderId],
    ]);
  }

  return invalidate(queryClient, keys);
}

export async function invalidateProductSuggestionsChanged(
  queryClient: QueryClient,
) {
  return invalidate(queryClient, [ROOTS.productSuggestions]);
}

export async function invalidateUsersChanged(queryClient: QueryClient) {
  return invalidate(queryClient, [ROOTS.users]);
}

export async function invalidateSystemJobsChanged(queryClient: QueryClient) {
  return invalidate(queryClient, [ROOTS.systemJobs]);
}

// Every customer key begins with "customers", so one root covers the list, the stats, the
// drawer and the statement. Breadth is cheap: invalidation refetches only mounted queries.
const REALTIME_KEYS: Record<RealtimeResource, readonly (readonly unknown[])[]> = {
  // Opening or closing an account moves card availability and the card-ordered list.
  customer: [ROOTS.customers, ROOTS.cards],
  "customer-deposit": [ROOTS.customers],
  "opening-balance": [ROOTS.customers, ROOTS.bills],
  "daily-ledger": [ROOTS.customers, ROOTS.dailyLedgers],
  bill: [ROOTS.bills, ROOTS.customers],
  payment: [ROOTS.payments, ROOTS.bills, ROOTS.customers],
  // Reassigning a card renumbers the customer list.
  card: [ROOTS.cards, ROOTS.customers],
  "function-order": [ROOTS.functionOrders],
  // A changed rate is printed against every customer that uses it.
  "milk-type": [ROOTS.milkTypes, ROOTS.customers],
  "product-suggestion": [ROOTS.productSuggestions],
  user: [ROOTS.users],
  "system-job": [ROOTS.systemJobs],
};

export async function invalidateFromRealtime(
  queryClient: QueryClient,
  event: RealtimeChangeEvent,
) {
  return invalidate(queryClient, REALTIME_KEYS[event.resource] ?? []);
}
