import type { PrismaClient } from "@prisma/client";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }

  interface FastifyRequest {
    accessTokenJwtVerify: () => Promise<void>;
    refreshTokenJwtVerify: () => Promise<void>;
  }
}