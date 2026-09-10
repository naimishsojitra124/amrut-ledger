import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "@/config/env";
import { loginSchema } from "./auth.schema";
import {
  getCurrentUser,
  getSessions,
  getRefreshCookieOptions,
  login,
  logoutSession,
  refreshSession,
  revokeSession,
} from "./auth.service";

function extractBearerToken(authorizationHeader?: string) {
  if (!authorizationHeader) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  return match?.[1];
}

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

export async function logoutHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const cookies = request.cookies as Record<string, string | undefined>;
  const refreshToken = cookies.refreshToken;
  // const accessToken = extractBearerToken(request.headers.authorization);

  await logoutSession(request.server, { refreshToken });

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
