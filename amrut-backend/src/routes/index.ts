import { authRoutes } from "@/modules/auth/auth.route";
import { billRoutes } from "@/modules/bills/bill.route";
import { cardRoutes } from "@/modules/cards/card.route";
import { customerRoutes } from "@/modules/customer/customer.route";
import { dailyLedgerRoutes } from "@/modules/daily-ledger/daily-ledger.route";
import { milkTypeRoutes } from "@/modules/milk-types/milk-type.route";
import { productSuggestionRoutes } from "@/modules/product-suggestions/product-suggestion.route";
import { userRoutes } from "@/modules/users/user.route";
import { functionOrderRoutes } from "@/modules/function-orders/function-order.route";
import { systemJobRoutes } from "@/modules/system-jobs/system-job.route";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client";
import { env } from "@/config/env";

export async function registerRoutes(app: FastifyInstance) {
  app.register(authRoutes, { prefix: "/auth" });

  app.register(milkTypeRoutes, { prefix: "/milk-types" });

  app.register(productSuggestionRoutes, { prefix: "/product-suggestions" });

  app.register(billRoutes);

  app.register(cardRoutes, { prefix: "/cards" });

  app.register(dailyLedgerRoutes, { prefix: "/customers" });

  app.register(customerRoutes, { prefix: "/customers" });

  app.register(userRoutes, { prefix: "/users" });
  app.register(functionOrderRoutes, { prefix: "/function-orders" });
  app.register(systemJobRoutes, { prefix: "/system/jobs" });

  app.get("/health", async () => ({ status: "ok" }));

  /**
   * Reports how long a trivial round trip to the database takes.
   *
   * Nearly all perceived slowness in this app is per-query network latency
   * rather than query cost: a page that runs six statements pays this number
   * six times. If `databaseRoundTripMs` is above ~50ms the application and the
   * database are probably in different regions, and no amount of query tuning
   * will fix that — move them together.
   */
  app.get("/health/db", async (request) => {
    const prisma = (request.server as typeof app & { prisma: PrismaClient }).prisma;

    const startedAt = performance.now();
    await prisma.$runCommandRaw({ ping: 1 });
    const first = performance.now() - startedAt;

    // A second sample, so a one-off connection setup is not mistaken for the
    // steady-state latency.
    const secondStartedAt = performance.now();
    await prisma.$runCommandRaw({ ping: 1 });
    const second = performance.now() - secondStartedAt;

    return {
      status: "ok",
      databaseRoundTripMs: Math.round(Math.min(first, second)),
      samplesMs: [Math.round(first), Math.round(second)],
      nodeEnv: env.nodeEnv,
    };
  });
}
