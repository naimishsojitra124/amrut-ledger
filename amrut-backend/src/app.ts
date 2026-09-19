import Fastify from "fastify";

import { registerAppPlugins } from "./app/plugins/register-plugins.js";
import { setGlobalErrorHandler } from "./app/middleware/error-handler.js";
import { registerRoutes } from "./routes/index.js";
import { env } from "./config/env.js";

export async function buildApp() {
  const app = Fastify({
    bodyLimit: 1_048_576,
    // Deployed behind a proxy. Without this every request reports the load
    // balancer's address, which makes per-client rate limiting meaningless and
    // request logs useless for tracing a device.
    trustProxy: true,
    logger: {
      level: env.logLevel,
      ...(env.logPretty
        ? {
            transport: {
              target: "pino-pretty",
              options: { colorize: true, translateTime: "SYS:standard" },
            },
          }
        : {}),
    },
  });

  if (env.nodeEnv !== "production") {
    app.log.warn(
      { nodeEnv: env.nodeEnv },
      "NODE_ENV is not \"production\". Secure cookies and CORS are not being enforced, " +
        "and debug logging is enabled. Set NODE_ENV=production on deployed environments.",
    );
  }

  // Reject Mongo operator/prototype keys before they reach application queries.
  app.addHook("preValidation", async (request) => {
    const inspect = (value: unknown): boolean => {
      if (!value || typeof value !== "object") return true;
      if (Array.isArray(value)) return value.every(inspect);
      return Object.entries(value as Record<string, unknown>).every(
        ([key, child]) =>
          !key.startsWith("$") &&
          !key.includes(".") &&
          key !== "__proto__" &&
          key !== "constructor" &&
          inspect(child),
      );
    };
    if (!inspect(request.body) || !inspect(request.query) || !inspect(request.params)) {
      throw app.httpErrors.badRequest("Invalid request field");
    }
  });
  app.addHook("onResponse", async (request, reply) => {
    const deviceId = request.headers["x-device-id"];
    // Debug, not info: this fires on every single request, and at info level it
    // doubled the log volume the server had to write while serving traffic.
    if (deviceId)
      request.log.debug(
        {
          deviceId,
          method: request.method,
          path: request.routeOptions.url,
          statusCode: reply.statusCode,
          syncedAt: new Date().toISOString(),
        },
        "device session activity",
      );
  });

  setGlobalErrorHandler(app);
  await registerAppPlugins(app);
  await registerRoutes(app);

  return app;
}
