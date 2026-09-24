import { env } from "@/config/env";
import type { Prisma } from "../../../generated/prisma/client";

// Prisma's 5s default is too tight when every statement is a cross-region round trip.
export const TX_OPTIONS = {
  timeout: env.dbTransactionTimeoutMs,
  maxWait: env.dbTransactionMaxWaitMs,
} as const;

// What `$transaction` hands its callback: the client minus the methods you cannot call
// inside one. Annotating a callback with the full `PrismaClient` does not type-check.
export type TransactionClient = Prisma.TransactionClient;
