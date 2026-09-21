import fp from "fastify-plugin";
import { PrismaClient } from "../../../generated/prisma/client";
import { env } from "@/config/env";

// Query logging is opt-in, not tied to NODE_ENV, because it costs real latency.
const prisma = new PrismaClient({
  log: env.prismaLogQueries ? ["query", "warn", "error"] : ["warn", "error"],
});

export const prismaPlugin = fp(async (app) => {
  app.decorate("prisma", prisma);

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});
