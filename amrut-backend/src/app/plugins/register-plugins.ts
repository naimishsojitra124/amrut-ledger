import type { FastifyInstance } from "fastify";
import sensible from "@fastify/sensible";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { env } from "@/config/env";

import { requestMetaPlugin } from "@/app/observability/request-meta.plugin";
import { RESPONSE_META_HEADERS } from "@/app/observability/request-meta.types";

import { prismaPlugin } from "./prisma.plugin.js";
import { jwtPlugin } from "./jwt.plugin.js";
import { swaggerPlugin } from "./swagger.plugin.js";
import { websocketPlugin } from "./websocket.plugin.js";
import { startDemoResetSchedule } from "@/modules/demo/demo-reset.service";

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
  // Keyed on IP: the JWT is not verified yet at onRequest, so per-account limiting is impossible here.
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: `Too many requests. Please retry in ${context.after}.`,
    }),
  });
  await app.register(cors, {
    origin: env.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    // Cross-origin reads see no response header unless it is named here.
    exposedHeaders: [...RESPONSE_META_HEADERS],
  });

  // First, so the timing it records covers every later plugin and handler.
  await app.register(requestMetaPlugin);

  await app.register(sensible);
  await app.register(prismaPlugin);
  await app.register(jwtPlugin);
  await app.register(swaggerPlugin);
  await app.register(websocketPlugin);

  // Inert unless DEMO_MODE is on.
  startDemoResetSchedule(app);
}
