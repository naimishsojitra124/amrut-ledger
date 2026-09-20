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

/**
 * Credential endpoints get their own, much tighter limit.
 *
 * The global limiter is sized for normal app traffic and does nothing to slow
 * down password guessing. The per-account lockout in the service only stops an
 * attacker hammering a single account — it does not stop one trying the same
 * password against every mobile number in turn, which this does.
 */
const LOGIN_RATE_LIMIT = {
  max: 10,
  timeWindow: "1 minute",
  /** Keyed on IP plus the account being tried, so spraying is limited too. */
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
  // Public: the login screen reads this before deciding whether to offer a
  // guest button. Returns nothing sensitive.
  app.get("/config", authConfigHandler);

  app.post("/login", { config: { rateLimit: LOGIN_RATE_LIMIT } }, loginHandler);
  app.get("/me", { preHandler: authenticate }, meHandler);
  app.get("/sessions", { preHandler: authenticate }, sessionsHandler);
  app.delete("/sessions/:id", { preHandler: authenticate }, revokeSessionHandler);
  app.post("/refresh", { config: { rateLimit: REFRESH_RATE_LIMIT } }, refreshHandler);
  app.post("/logout", logoutHandler);
};
