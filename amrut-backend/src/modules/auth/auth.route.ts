import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { authenticate } from "@/app/middleware/authenticate";
import {
  authConfigHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  revokeSessionHandler,
  sessionsHandler,
} from "./auth.controller";

// Keyed on IP and account, so password spraying across many numbers is limited too.
const LOGIN_RATE_LIMIT = {
  max: 10,
  timeWindow: "1 minute",
  keyGenerator: (request: FastifyRequest) => {
    const body = request.body as { mobileNumber?: unknown } | undefined;
    const mobileNumber = typeof body?.mobileNumber === "string" ? body.mobileNumber : "";
    return `login:${request.ip}:${mobileNumber}`;
  },
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: "Too Many Requests",
    message: "Too many login attempts. Please wait a minute and try again.",
  }),
};

const REFRESH_RATE_LIMIT = {
  max: 60,
  timeWindow: "1 minute",
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: "Too Many Requests",
    message: "Too many requests. Please wait a moment and try again.",
  }),
};

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Public: the login screen reads this before offering a guest button.
  app.get("/config", authConfigHandler);

  app.post("/login", { config: { rateLimit: LOGIN_RATE_LIMIT } }, loginHandler);
  app.get("/me", { preHandler: authenticate }, meHandler);
  app.get("/sessions", { preHandler: authenticate }, sessionsHandler);
  app.delete("/sessions/:id", { preHandler: authenticate }, revokeSessionHandler);
  app.post("/refresh", { config: { rateLimit: REFRESH_RATE_LIMIT } }, refreshHandler);
  app.post("/logout", logoutHandler);
};
