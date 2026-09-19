import fp from "fastify-plugin";
import { PrismaClient } from "../../../generated/prisma/client";
import { env } from "@/config/env";

/**
 * Query logging is opt-in through PRISMA_LOG_QUERIES.
 *
 * It used to switch on whenever NODE_ENV was not exactly "development", which
 * meant a deployment that forgot to set NODE_ENV=production logged every query
 * it ran — thousands of lines a minute, and measurable latency on each one.
 */
const prisma = new PrismaClient({
  log: env.prismaLogQueries ? ["query", "warn", "error"] : ["warn", "error"],
});

export const prismaPlugin = fp(async (app) => {
  app.decorate("prisma", prisma);

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});
