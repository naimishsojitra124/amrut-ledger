import bcrypt from "bcrypt";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
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
import { createHttpError } from "@/app/http-error";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

// A replaced refresh token keeps working for this long. Two tabs reloading together
// both send the cookie they had, and the slower one must not lose its session.
const ROTATION_GRACE_MS = 60_000;

// Every user-visible refusal reads the same, so a signed-out visitor learns nothing about
// which check failed, while the log records exactly which one did.
function refusal(app: FastifyInstance, reason: string, userId: string | null) {
  app.log.info({ reason, userId, scope: "auth.refresh" }, "refresh refused");
  return createHttpError(401, "Your session has expired. Please sign in again.");
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

// Sends the resolved permissions, so the UI never holds its own copy of the access matrix.
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

function hashRefreshToken(refreshToken: string): string {
  return createHash("sha256").update(refreshToken).digest("hex");
}

const SHA256_HEX = /^[a-f0-9]{64}$/;

function hashesMatch(refreshToken: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !SHA256_HEX.test(storedHash)) return false;

  const presented = Buffer.from(hashRefreshToken(refreshToken), "hex");
  const stored = Buffer.from(storedHash, "hex");

  return presented.length === stored.length && timingSafeEqual(presented, stored);
}

async function comparePassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

// Sessions created before the switch still hold a bcrypt hash. They are accepted once and
// rewritten as SHA-256 on that refresh, so nobody is signed out by the deployment itself.
async function refreshTokenMatches(
  refreshToken: string,
  session: { refreshTokenHash: string; previousRefreshTokenHash?: string | null; previousHashExpiresAt?: Date | null },
): Promise<boolean> {
  if (hashesMatch(refreshToken, session.refreshTokenHash)) return true;

  const graceOpen =
    session.previousHashExpiresAt instanceof Date && session.previousHashExpiresAt > new Date();

  if (graceOpen && hashesMatch(refreshToken, session.previousRefreshTokenHash)) return true;

  if (session.refreshTokenHash.startsWith("$2")) {
    return bcrypt.compare(refreshToken, session.refreshTokenHash);
  }

  return false;
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
  const refreshTokenHash = hashRefreshToken(refreshToken);
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

// Public by design: the login screen prints these.
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
    throw refusal(app, "refresh_token_signature_invalid_or_expired", null);
  }

  if (payload.tokenType !== "refresh") {
    throw refusal(app, "not_a_refresh_token", payload.sub);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
  });

  if (!user) {
    throw refusal(app, "user_not_found", payload.sub);
  }

  if (user.status === "inactive") {
    throw createHttpError(403, "Account is inactive");
  }

  const session = await prisma.authSession.findUnique({ where: { sessionId: payload.sid } });

  // Named reasons, because "logged out again" is impossible to diagnose from a bare 401.
  if (!session) throw refusal(app, "session_not_found", payload.sub);
  if (session.userId !== user.id) throw refusal(app, "session_user_mismatch", payload.sub);
  if (session.revokedAt) throw refusal(app, "session_revoked", payload.sub);
  if (session.expiresAt <= new Date()) throw refusal(app, "session_expired", payload.sub);

  if (!(await refreshTokenMatches(refreshToken, session))) {
    throw refusal(app, "token_does_not_match_session", payload.sub);
  }

  const accessToken = signAccessToken(app, user);
  const nextRefreshToken = signRefreshToken(user, session.sessionId);
  const nextRefreshTokenHash = hashRefreshToken(nextRefreshToken);

  await prisma.authSession.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: nextRefreshTokenHash,
      // The token just replaced stays usable briefly, so a second tab mid-reload survives.
      previousRefreshTokenHash: session.refreshTokenHash,
      previousHashExpiresAt: new Date(Date.now() + ROTATION_GRACE_MS),
      lastUsedAt: new Date(),
    },
  });

  return {
    user: normalizeUser(user),
    accessToken,
    refreshToken: nextRefreshToken,
  };
}

// Always succeeds: if no session can be identified there is nothing to end.
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

        if (session && (await refreshTokenMatches(input.refreshToken, session))) {
          sessionId = candidate;
        }
      }
    }
  }

  if (sessionId) {
    // No revokedAt filter: the write is idempotent, and filtering on it matched nothing
    // on rows where the field was never written, which left logout revoking nothing.
    await prisma.authSession.updateMany({
      where: { sessionId },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  // Without the cookie there is no proof of which session is ending. Signing out every
  // device the account has would take the whole shop offline because one phone lost a
  // cookie, so this signs out nothing and lets the unusable token expire on its own.
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
