import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import type { FastifyInstance } from "fastify";
import { env } from "@/config/env";
import { getPermissionsForRole } from "@/app/auth/permissions";
import { DEMO_ACCOUNT } from "@/modules/demo/demo-reset.service";
import type { UserRole, UserStatus } from "../../../generated/prisma/enums";
import type { User } from "../../../generated/prisma/client";
import type {
  AuthUser,
  JwtSessionPayload,
  LoginRequest,
  RefreshResponse,
  LoginResponse,
} from "./auth.types";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function createHttpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}

function prismaOf(app: FastifyInstance) {
  return (app as unknown as { prisma: any }).prisma as {
    user: {
      findUnique: Function;
      update: Function;
    };
    authSession: {
      create: Function;
      findUnique: Function;
      update: Function;
      updateMany: Function;
      findMany: Function;
    };
  };
}

/**
 * The signed-in user, with the permissions their role grants.
 *
 * Sending the resolved list means the UI never keeps its own copy of the access
 * matrix: `app/auth/permissions.ts` stays the only place access is decided, and
 * the two sides cannot drift apart.
 */
function normalizeUser(
  user: Pick<User, "id" | "fullName" | "mobileNumber" | "email" | "role" | "status">,
): AuthUser {
  return {
    id: user.id,
    fullName: user.fullName,
    mobileNumber: user.mobileNumber,
    email: user.email,
    role: user.role as UserRole,
    status: user.status as UserStatus,
    permissions: [...getPermissionsForRole(user.role as UserRole)],
  };
}

function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/i.exec(value.trim());
  if (!match) return 30 * 24 * 60 * 60;

  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase();

  switch (unit) {
    case "s":
      return amount;
    case "m":
      return amount * 60;
    case "h":
      return amount * 60 * 60;
    case "d":
      return amount * 24 * 60 * 60;
    default:
      return 30 * 24 * 60 * 60;
  }
}

export function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: "/",
    maxAge: parseDurationToSeconds(env.jwtRefreshExpiresIn.toString()),
  } as const;
}

function signAccessToken(app: FastifyInstance, user: Pick<User, "id" | "role">) {
  const payload: JwtSessionPayload = {
    sub: user.id,
    role: user.role as UserRole,
    tokenType: "access",
  };

  return app.jwt.sign(payload, {
    expiresIn: env.jwtAccessExpiresIn,
  });
}

function signRefreshToken(user: Pick<User, "id" | "role">, sessionId: string) {
  const payload: JwtSessionPayload = {
    sub: user.id,
    role: user.role as UserRole,
    tokenType: "refresh",
    sid: sessionId,
  };

  const expiresIn = env.jwtRefreshExpiresIn ?? "7d";

  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn,
  });
}

function verifyRefreshToken(refreshToken: string): JwtSessionPayload {
  const decoded = jwt.verify(refreshToken, env.jwtRefreshSecret);

  if (typeof decoded === "string") {
    throw createHttpError(401, "Invalid refresh token");
  }

  const payload = decoded as jwt.JwtPayload & Partial<JwtSessionPayload>;

  if (
    payload.tokenType !== "refresh" ||
    typeof payload.sub !== "string" ||
    typeof payload.sid !== "string"
  ) {
    throw createHttpError(401, "Invalid refresh token");
  }

  return {
    sub: payload.sub,
    role: payload.role as UserRole,
    tokenType: "refresh",
    sid: payload.sid,
  };
}

async function hashRefreshToken(refreshToken: string) {
  return bcrypt.hash(refreshToken, env.bcryptSaltRounds);
}

async function comparePassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

async function compareRefreshToken(refreshToken: string, refreshTokenHash: string) {
  return bcrypt.compare(refreshToken, refreshTokenHash);
}

export async function login(
  app: FastifyInstance,
  input: LoginRequest,
  deviceId = "",
): Promise<LoginResponse & { refreshToken: string }> {
  const prisma = prismaOf(app);
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { mobileNumber: input.mobileNumber },
  });

  if (!user) {
    throw createHttpError(401, "Invalid mobile number or password");
  }

  if (user.status === "inactive") {
    throw createHttpError(403, "Account is inactive");
  }

  if (user.lockUntil && user.lockUntil > now) {
    throw createHttpError(423, "Account is locked. Try again later.");
  }

  const passwordValid = await comparePassword(input.password, user.passwordHash);

  if (!passwordValid) {
    // The shared demo account is exempt from lockout. It is one account used by
    // everyone, so a handful of mistyped attempts would otherwise take the
    // whole demo offline for the next visitor.
    if (user.role === "guest") {
      throw createHttpError(401, "Invalid mobile number or password");
    }

    const nextAttempts = (user.failedLoginAttempts ?? 0) + 1;
    const shouldLock = nextAttempts >= MAX_LOGIN_ATTEMPTS;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: nextAttempts,
        lockUntil: shouldLock ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null,
      },
    });

    throw createHttpError(401, "Invalid mobile number or password");
  }

  const accessToken = signAccessToken(app, user);
  const sessionId = randomUUID();
  const refreshToken = signRefreshToken(user, sessionId);
  const refreshTokenHash = await hashRefreshToken(refreshToken);
  const expiresAt = new Date(
    Date.now() + parseDurationToSeconds(env.jwtRefreshExpiresIn.toString()) * 1000,
  );

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockUntil: null,
      lastLoginAt: now,
      refreshTokenHash: null,
    },
  });
  await prisma.authSession.create({
    data: {
      sessionId,
      userId: user.id,
      deviceId: deviceId.slice(0, 128),
      refreshTokenHash,
      expiresAt,
    },
  });

  return {
    user: normalizeUser(updatedUser),
    accessToken,
    refreshToken,
  };
}

/** Shown on the demo login screen so a reviewer can sign straight in. */
export function getDemoCredentials() {
  return {
    mobileNumber: DEMO_ACCOUNT.mobileNumber,
    password: env.demoGuestPassword,
  };
}

export async function getCurrentUser(app: FastifyInstance, userId: string) {
  const prisma = prismaOf(app);

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw createHttpError(401, "Unauthorized");
  }

  if (user.status === "inactive") {
    throw createHttpError(403, "Account is inactive");
  }

  return {
    user: normalizeUser(user),
  };
}

export async function refreshSession(
  app: FastifyInstance,
  refreshToken: string,
): Promise<RefreshResponse & { refreshToken: string }> {
  const prisma = prismaOf(app);

  let payload: JwtSessionPayload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw createHttpError(401, "Invalid refresh token");
  }

  if (payload.tokenType !== "refresh") {
    throw createHttpError(401, "Invalid refresh token");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
  });

  if (!user) {
    throw createHttpError(401, "Unauthorized");
  }

  if (user.status === "inactive") {
    throw createHttpError(403, "Account is inactive");
  }

  const session = await prisma.authSession.findUnique({ where: { sessionId: payload.sid } });
  if (
    !session ||
    session.userId !== user.id ||
    session.revokedAt ||
    session.expiresAt <= new Date()
  )
    throw createHttpError(401, "Session expired");

  const tokenMatches = await compareRefreshToken(refreshToken, session.refreshTokenHash);

  if (!tokenMatches) {
    throw createHttpError(401, "Session expired");
  }

  const accessToken = signAccessToken(app, user);
  const nextRefreshToken = signRefreshToken(user, session.sessionId);
  const nextRefreshTokenHash = await hashRefreshToken(nextRefreshToken);

  await prisma.authSession.update({
    where: { id: session.id },
    data: { refreshTokenHash: nextRefreshTokenHash, lastUsedAt: new Date() },
  });

  return {
    user: normalizeUser(user),
    accessToken,
    refreshToken: nextRefreshToken,
  };
}

/**
 * Logging out always succeeds.
 *
 * Previously a missing or expired refresh cookie made this throw 401, which
 * meant the client cleared its own state while the server-side session stayed
 * alive for the full 30-day refresh window. Logout is a request to end a
 * session; if we cannot identify one there is nothing to end, and that is a
 * success, not an error.
 *
 * When the cookie is unreadable we fall back to the access token so an expired
 * refresh token still revokes the right session.
 */
export async function logoutSession(
  app: FastifyInstance,
  input: { userId?: string | undefined; refreshToken?: string | undefined },
): Promise<{ success: true }> {
  const prisma = prismaOf(app);

  let sessionId: string | null = null;

  if (input.refreshToken) {
    try {
      sessionId = verifyRefreshToken(input.refreshToken).sid ?? null;
    } catch {
      // Expired or tampered cookie. Fall through to the access token below.
    }

    if (!sessionId) {
      // The signature failed, but the payload may still name the session. Only
      // trust it after confirming the stored hash matches the presented token.
      const decoded = jwt.decode(input.refreshToken);
      const candidate =
        decoded && typeof decoded === "object" && typeof decoded.sid === "string"
          ? decoded.sid
          : null;

      if (candidate) {
        const session = await prisma.authSession.findUnique({
          where: { sessionId: candidate },
        });

        if (session && (await compareRefreshToken(input.refreshToken, session.refreshTokenHash))) {
          sessionId = candidate;
        }
      }
    }
  }

  if (sessionId) {
    await prisma.authSession.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  // No usable refresh token. If the caller still holds a valid access token we
  // revoke every session they have, so a stale cookie cannot leave one behind.
  if (input.userId) {
    await prisma.authSession.updateMany({
      where: { userId: input.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  return { success: true };
}

export async function getSessions(app: FastifyInstance, userId: string) {
  const sessions = await prismaOf(app).authSession.findMany({
    where: { userId },
    orderBy: { lastUsedAt: "desc" },
  });
  return {
    items: sessions.map((session: any) => ({
      id: session.id,
      deviceId: session.deviceId,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
    })),
  };
}

export async function revokeSession(app: FastifyInstance, userId: string, sessionId: string) {
  const session = await prismaOf(app).authSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) throw createHttpError(404, "Session not found");
  await prismaOf(app).authSession.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
  return { success: true } as const;
}
