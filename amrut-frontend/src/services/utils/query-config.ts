import axios from "axios";

export const QUERY_STALE_TIMES = {
  customersList: 90_000,
  customerStats: 75_000,
  customerDetail: 120_000,
  customerDailyHistory: 90_000,
  customerBills: 90_000,
  customerPayments: 80_000,
  customerAuditLogs: 5 * 60_000,
  customerStatement: 90_000,

  billsList: 75_000,
  billsSummary: 70_000,
  billDetail: 90_000,
  customerBillByMonth: 90_000,
  overdueBills: 90_000,

  paymentsList: 80_000,
  paymentsSummary: 75_000,
  billPayments: 80_000,
  paymentDetail: 90_000,

  dailyLedger: 60_000,

  cardsList: 180_000,
  availableCards: 120_000,
  cardNumbering: 5 * 60_000,
  cardDetail: 180_000,
  cardHistory: 180_000,

  functionOrdersList: 120_000,
  functionOrderAuditLogs: 5 * 60_000,

  productSuggestionsList: 10 * 60_000,
  activeProductSuggestions: 10 * 60_000,

  usersList: 180_000,
  userStats: 180_000,
  userDetail: 180_000,

  systemJobs: 60_000,

  serviceHealth: 20_000,
} as const;

export const QUERY_REFETCH_INTERVALS = {
  customersList: 6 * 60_000,
  customerStats: 5 * 60_000,

  billsList: 5 * 60_000 + 15_000,
  billsSummary: 5 * 60_000 + 30_000,
  overdueBills: 6 * 60_000,

  paymentsList: 5 * 60_000 + 45_000,
  paymentsSummary: 5 * 60_000 + 45_000,

  cardsList: 7 * 60_000,
  availableCards: 6 * 60_000,

  functionOrdersList: 4 * 60_000 + 45_000,

  productSuggestionsList: 15 * 60_000,
  activeProductSuggestions: 15 * 60_000,

  usersList: 8 * 60_000,
  userStats: 8 * 60_000,

  systemJobs: 3 * 60_000 + 45_000,

  serviceHealth: 30_000,
} as const;

export const QUERY_GC_TIMES = {
  short: 5 * 60_000,
  standard: 15 * 60_000,
  long: 30 * 60_000,
} as const;

type QueryErrorWithStatus = {
  response?: {
    status?: number;
  };
};

function getStatusCode(error: unknown): number | undefined {
  if (axios.isAxiosError(error)) {
    return error.response?.status;
  }

  if (typeof error === "object" && error !== null && "response" in error) {
    return (error as QueryErrorWithStatus).response?.status;
  }

  return undefined;
}

/**
 * Network/server failures may be retried once.
 *
 * Client validation/auth/permission/not-found failures should not be
 * retried because repeating the same request will not fix them.
 */
export function retryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) {
    return false;
  }

  const status = getStatusCode(error);

  if (status === undefined) {
    return true;
  }

  if (status === 401 || status === 403 || status === 404) {
    return false;
  }

  if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
    return false;
  }

  return true;
}

/**
 * Refetching on focus is what makes a second device feel current without
 * anyone reloading: returning to the tab pulls whatever changed while it was
 * in the background. The per-query `staleTime` keeps this from turning into a
 * request on every alt-tab.
 */
export const STANDARD_QUERY_BEHAVIOR = {
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  refetchOnMount: true,
  retry: retryQuery,
} as const;

export const FINANCIAL_QUERY_BEHAVIOR = {
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  refetchOnMount: true,
  retry: retryQuery,
} as const;

// Catalogue data barely changes, so it does not need a focus refetch.
export const STATIC_QUERY_BEHAVIOR = {
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
  refetchOnMount: true,
  retry: retryQuery,
} as const;
