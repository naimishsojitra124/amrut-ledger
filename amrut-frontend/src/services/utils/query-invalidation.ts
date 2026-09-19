import type { QueryClient } from "@tanstack/react-query";

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

/**
 * Customer creation affects all customer list variants and statistics.
 * Available cards are also affected because a newly created customer can
 * become eligible for card assignment workflows.
 */
export async function invalidateCustomerCreated(queryClient: QueryClient) {
  return invalidate(queryClient, [
    ROOTS.customerList,
    ROOTS.customerStats,
    ROOTS.availableCards,
    ROOTS.cardNumbering
  ]);
}

/**
 * An opening balance is a receivable, so it moves the customer's outstanding
 * total, their bill list and every bill-wide aggregate it feeds.
 */
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

/**
 * Customer profile updates can change every customer-facing representation,
 * but do not need bill/payment-wide invalidation.
 */
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

/**
 * Archive/restore changes list membership/status and customer statistics.
 */
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

/**
 * Ledger mutations can change the visible customer outstanding amount,
 * daily history, statement and derived customer financial views.
 *
 * The specific ledger cache is written directly by the mutation, while these
 * dependent queries are invalidated/refetched when active.
 */
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
  ]);
}

/**
 * Bill generation changes bill lists/summaries and customer financial views.
 */
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

/**
 * A payment changes the payment history, bill state, outstanding balance,
 * customer financial views and dashboard aggregates.
 */
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

/**
 * Deposit changes the customer's account/statement and potentially the
 * balance shown in customer list/detail views.
 */
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

/**
 * Card mutations affect list, available-card selectors and numbering.
 */
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

/**
 * Function orders are operational data. Any mutation can affect dashboard
 * upcoming orders, list views and reminders.
 */
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

/**
 * Product suggestions are master data used by Quick Entry.
 */
export async function invalidateProductSuggestionsChanged(
  queryClient: QueryClient,
) {
  return invalidate(queryClient, [ROOTS.productSuggestions]);
}

/**
 * Users are master/admin data. Updating one user does not require touching
 * unrelated business-data caches.
 */
export async function invalidateUsersChanged(queryClient: QueryClient) {
  return invalidate(queryClient, [ROOTS.users]);
}

/**
 * System job changes only affect scheduler status.
 */
export async function invalidateSystemJobsChanged(queryClient: QueryClient) {
  return invalidate(queryClient, [ROOTS.systemJobs]);
}
