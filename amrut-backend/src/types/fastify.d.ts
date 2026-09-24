import type { PrismaClient } from "@prisma/client";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    realtime: import("@/app/realtime/realtime.hub").RealtimeHub;
  }

  interface FastifyRequest {
    accessTokenJwtVerify: () => Promise<void>;
    refreshTokenJwtVerify: () => Promise<void>;
  }
}
