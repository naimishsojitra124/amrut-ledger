import { env } from "@/config/env";

/**
 * Options applied to every interactive transaction.
 *
 * Prisma defaults to a 5 second budget. Each statement inside a transaction is
 * its own round trip, so when the application and the database sit in different
 * regions even a handful of writes can exhaust that before finishing — which is
 * what made customer creation fail with P2028 whenever a deposit was involved.
 *
 * Raising the ceiling is the safety net, not the fix: the transactions
 * themselves were shortened first. Tune with DB_TRANSACTION_TIMEOUT_MS.
 */
export const TX_OPTIONS = {
  timeout: env.dbTransactionTimeoutMs,
  maxWait: env.dbTransactionMaxWaitMs,
} as const;
