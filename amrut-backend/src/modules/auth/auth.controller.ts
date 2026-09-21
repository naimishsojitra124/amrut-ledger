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

export async function authConfigHandler(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send({
    demoMode: env.demoMode,
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

// Clears the cookie and returns 200 either way, so the client is never out of step with the server.
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
