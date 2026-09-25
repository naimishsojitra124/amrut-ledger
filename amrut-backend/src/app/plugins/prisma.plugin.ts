import fp from "fastify-plugin";
import { PrismaClient } from "../../../generated/prisma/client";
import { env } from "@/config/env";

// Query logging is opt-in, not tied to NODE_ENV, because it costs real latency.
const prisma = new PrismaClient({
  log: env.prismaLogQueries ? ["query", "warn", "error"] : ["warn", "error"],
});

export const prismaPlugin = fp(async (app) => {
  app.decorate("prisma", prisma);

  // Prisma connects lazily, which charges the MongoDB handshake to whichever request
  // arrives first. Starting it here overlaps it with the rest of boot instead, and is
  // deliberately not awaited so a slow database cannot hold the port closed.
  void prisma
    .$connect()
    .catch((error: unknown) => app.log.error({ err: error }, "prisma: initial connect failed"));

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});
