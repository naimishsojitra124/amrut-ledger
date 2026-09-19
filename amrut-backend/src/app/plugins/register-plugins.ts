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
  /**
   * The app runs behind a proxy (Vercel / Render / nginx), so `request.ip` is
   * the proxy's address unless `trustProxy` is set on the server — see app.ts.
   * With that in place each device gets its own bucket again; previously the
   * whole shop shared one, and `ban` could lock every user out at once.
   *
   * The limit is deliberately generous for normal use. Authentication gets a
   * far tighter, dedicated limiter in auth.route.ts.
   */
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      // Authenticated users are limited per account, not per shared IP.
      const user = request.user as { sub?: string } | undefined;
      return user?.sub ?? request.ip;
    },
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
  });

  await app.register(sensible);
  await app.register(prismaPlugin);
  await app.register(jwtPlugin);
  await app.register(swaggerPlugin);
  await app.register(websocketPlugin);
}
