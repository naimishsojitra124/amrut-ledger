import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "@/config/env";
import { loginSchema } from "./auth.schema";
import {
  getCurrentUser,
  getDemoCredentials,
  getSessions,
  getRefreshCookieOptions,
  login,
  logoutSession,
  refreshSession,
  revokeSession,
} from "./auth.service";

export async function loginHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = loginSchema.parse(request.body);
  const deviceHeader = request.headers["x-device-id"];
  const result = await login(request.server, body, typeof deviceHeader === "string" ? deviceHeader : "");

  reply.setCookie("refreshToken", result.refreshToken, getRefreshCookieOptions());

  return reply.send({
    user: result.user,
    accessToken: result.accessToken,
  });
}

/**
 * Tells the frontend whether the demo door exists here, so it only offers
 * "Explore as guest" on a deployment that actually has one.
 */
export async function authConfigHandler(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send({
    demoMode: env.demoMode,
    // Published on purpose: the login screen shows these so a reviewer can
    // sign straight in. Only ever sent by a demo deployment.
    demoCredentials: env.demoMode ? getDemoCredentials() : null,
    demoResetIntervalHours: env.demoMode ? env.demoResetIntervalHours : null,
  });
}

export async function meHandler(request: FastifyRequest, reply: FastifyReply) {
  const payload = request.user as { sub?: string };

  if (!payload?.sub) {
    return reply.status(401).send({ message: "Unauthorized" });
  }

  const result = await getCurrentUser(request.server, payload.sub);

  return reply.send(result);
}

export async function refreshHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const cookies = request.cookies as Record<string, string | undefined>;
  const refreshToken = cookies.refreshToken;

  if (!refreshToken) {
    return reply.status(401).send({ message: "Missing refresh token" });
  }

  const result = await refreshSession(request.server, refreshToken);

  reply.setCookie("refreshToken", result.refreshToken, getRefreshCookieOptions());

  return reply.send({
    user: result.user,
    accessToken: result.accessToken,
  });
}

/**
 * Logout is idempotent: it clears the cookie and returns 200 whether or not a
 * live session could be identified, so the client is never left believing it
 * signed out while the server-side session is still valid.
 */
export async function logoutHandler(request: FastifyRequest, reply: FastifyReply) {
  const cookies = request.cookies as Record<string, string | undefined>;
  const refreshToken = cookies.refreshToken;

  // The access token is optional here — it lets us revoke the session even
  // when the refresh cookie is missing or already expired.
  let userId: string | undefined;

  try {
    await request.jwtVerify();
    userId = (request.user as { sub?: string } | undefined)?.sub;
  } catch {
    // No usable access token; the refresh cookie alone has to do.
  }

  await logoutSession(request.server, { refreshToken, userId });

  reply.clearCookie("refreshToken", {
    path: "/",
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
  });

  return reply.send({ success: true });
}

export async function sessionsHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(await getSessions(request.server, (request.user as { sub: string }).sub));
}

export async function revokeSessionHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(await revokeSession(request.server, (request.user as { sub: string }).sub, (request.params as { id: string }).id));
}
