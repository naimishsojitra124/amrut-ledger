import type { FastifyInstance } from "fastify";
import sensible from "@fastify/sensible";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { env } from "@/config/env";

import { prismaPlugin } from "./prisma.plugin.js";
import { jwtPlugin } from "./jwt.plugin.js";
import { swaggerPlugin } from "./swagger.plugin.js";
import { websocketPlugin } from "./websocket.plugin.js";

export async function registerAppPlugins(app: FastifyInstance) {
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: "same-site" },
  });
  await app.register(rateLimit, { global: true, max: 180, timeWindow: "1 minute", ban: 2 });
  await app.register(cors, {
    origin: env.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await app.register(sensible);
  await app.register(prismaPlugin);
  await app.register(jwtPlugin);
  await app.register(swaggerPlugin);
  await app.register(websocketPlugin);
}
