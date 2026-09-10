import fp from "fastify-plugin";
import { PrismaClient } from "../../../generated/prisma/client"
import { env } from "@/config/env";

const prisma = new PrismaClient({
  log:
    env.nodeEnv === "development"
      ? ["query", "warn", "error"]
      : ["error"],
});

export const prismaPlugin = fp(async (app) => {
  app.decorate("prisma", prisma);

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});