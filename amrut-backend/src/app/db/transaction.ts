import { env } from "@/config/env";

// Prisma's 5s default is too tight when every statement is a cross-region round trip.
export const TX_OPTIONS = {
  timeout: env.dbTransactionTimeoutMs,
  maxWait: env.dbTransactionMaxWaitMs,
} as const;
