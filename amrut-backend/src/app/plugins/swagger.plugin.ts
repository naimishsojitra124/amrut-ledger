import fp from "fastify-plugin";

import { env } from "@/config/env";

// An unauthenticated map of every route, so it stays off in production by default.
export const swaggerPlugin = fp(async (app) => {
  if (!env.enableApiDocs) {
    app.log.info("API docs disabled; set ENABLE_API_DOCS=true to serve /docs");
    return;
  }

  await app.register(import("@fastify/swagger"), {
    openapi: {
      info: {
        title: "Amrut Ledger API",
        description: "Backend APIs for Amrut Ledger",
        version: "1.0.0",
      },
      servers: [{ url: env.publicApiUrl ?? `http://localhost:${env.port}` }],
    },
  });

  await app.register(import("@fastify/swagger-ui"), {
    routePrefix: "/docs",
  });
});
