import fp from "fastify-plugin";

export const swaggerPlugin = fp(async (app) => {
  await app.register(import("@fastify/swagger"), {
    openapi: {
      info: {
        title: "Amrut Ledger API",
        description: "Backend APIs for Amrut Ledger",
        version: "1.0.0",
      },
      servers: [{ url: "http://localhost:5000" }],
    },
  });

  await app.register(import("@fastify/swagger-ui"), {
    routePrefix: "/docs",
  });
});