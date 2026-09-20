import bcrypt from "bcrypt";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../../generated/prisma/client";
import type {
  ChangeUserPasswordRequest,
  ChangeUserRoleRequest,
  CreateUserRequest,
  PageInfo,
  UpdateUserRequest,
  UserListQuery,
  UserListResponse,
  UserResponse,
  UserStatsResponse,
} from "./user.types";
import { env } from "@/config/env";
import { assertCanActOnUser, assertNotDemoAccount } from "@/app/middleware/authorize";
import type { UserRole } from "../../../generated/prisma/enums";

function createHttpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}

function getPrisma(app: FastifyInstance) {
  return (app as FastifyInstance & { prisma: PrismaClient }).prisma;
}

function normalizeUser(user: {
  id: string;
  fullName: string;
  mobileNumber: string;
  email: string;
  role: "owner" | "manager" | "employee";
  status: "active" | "inactive";
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): UserResponse {
  return {
    id: user.id,
    fullName: user.fullName,
    mobileNumber: user.mobileNumber,
    email: user.email,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function buildPageInfo(totalItems: number, page: number, limit: number): PageInfo {
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

function buildSearchWhere(search?: string) {
  if (!search) return undefined;

  return {
    OR: [
      {
        fullName: {
          contains: search,
          mode: "insensitive" as const,
        },
      },
      {
        mobileNumber: {
          contains: search,
        },
      },
      {
        email: {
          contains: search,
          mode: "insensitive" as const,
        },
      },
    ],
  };
}

async function isLastActiveOwner(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || user.role !== "owner" || user.status !== "active") {
    return false;
  }

  const ownerCount = await prisma.user.count({
    where: {
      role: "owner",
      status: "active",
    },
  });

  return ownerCount <= 1;
}

async function ensureUniqueMobileAndEmail(
  prisma: PrismaClient,
  userId: string | null,
  mobileNumber?: string,
  email?: string,
) {
  if (mobileNumber !== undefined) {
    const duplicateMobile = await prisma.user.findUnique({
      where: { mobileNumber },
    });

    if (duplicateMobile && duplicateMobile.id !== userId) {
      throw createHttpError(409, "Mobile number already exists");
    }
  }

  if (email !== undefined) {
    const duplicateEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (duplicateEmail && duplicateEmail.id !== userId) {
      throw createHttpError(409, "Email already exists");
    }
  }
}

export async function getUsers(
  app: FastifyInstance,
  query: UserListQuery,
): Promise<UserListResponse> {
  const prisma = getPrisma(app);

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = {
    ...(buildSearchWhere(query.search?.trim()) ?? {}),
  };

  const [totalItems, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip,
      take: limit,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  return {
    items: items.map(normalizeUser),
    pageInfo: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

export async function getUserById(
  app: FastifyInstance,
  id: string,
): Promise<UserResponse> {
  const prisma = getPrisma(app);

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw createHttpError(404, "User not found");
  }

  return normalizeUser(user);
}

export async function getUserStats(
  app: FastifyInstance,
): Promise<UserStatsResponse> {
  const prisma = getPrisma(app);

  const [totalUsers, activeUsers, inactiveUsers, ownerCount, managerCount, employeeCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "active" } }),
      prisma.user.count({ where: { status: "inactive" } }),
      prisma.user.count({ where: { role: "owner" } }),
      prisma.user.count({ where: { role: "manager" } }),
      prisma.user.count({ where: { role: "employee" } }),
    ]);

  return {
    totalUsers,
    activeUsers,
    inactiveUsers,
    ownerCount,
    managerCount,
    employeeCount,
  };
}

export async function createUser(
  app: FastifyInstance,
  input: CreateUserRequest,
  actor: { sub: string; role: UserRole },
): Promise<UserResponse> {
  const prisma = getPrisma(app);

  // Creating an account more senior than your own is an escalation route.
  assertCanActOnUser(actor, { id: "", role: input.role });

  const mobileNumber = input.mobileNumber.trim();
  const email = input.email.trim().toLowerCase();

  await ensureUniqueMobileAndEmail(prisma, null, mobileNumber, email);

  const passwordHash = await bcrypt.hash(input.password, env.bcryptSaltRounds);

  const user = await prisma.user.create({
    data: {
      fullName: input.fullName.trim(),
      mobileNumber,
      email,
      passwordHash,
      role: input.role,
      status: "active",
      failedLoginAttempts: 0,
      lockUntil: null,
    },
  });

  return normalizeUser(user);
}

export async function updateUser(
  app: FastifyInstance,
  id: string,
  input: UpdateUserRequest,
  actor: { sub: string; role: UserRole },
): Promise<UserResponse> {
  const prisma = getPrisma(app);

  const existing = await prisma.user.findUnique({
    where: { id },
  });

  if (!existing) {
    throw createHttpError(404, "User not found");
  }

  assertCanActOnUser(actor, { id: existing.id, role: existing.role });
  assertNotDemoAccount(existing);

  const nextMobileNumber =
    input.mobileNumber !== undefined ? input.mobileNumber.trim() : undefined;
  const nextEmail =
    input.email !== undefined ? input.email.trim().toLowerCase() : undefined;

  await ensureUniqueMobileAndEmail(prisma, id, nextMobileNumber, nextEmail);

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(input.fullName !== undefined ? { fullName: input.fullName.trim() } : {}),
      ...(nextMobileNumber !== undefined ? { mobileNumber: nextMobileNumber } : {}),
      ...(nextEmail !== undefined ? { email: nextEmail } : {}),
    },
  });

  return normalizeUser(user);
}

/**
 * Sets another user's password without knowing the current one.
 *
 * The seniority check is the important part: holding the reset permission must
 * never let someone reach an account at or above their own level. A manager
 * resetting the owner's password and then signing in as them would otherwise be
 * a complete takeover of the system.
 */
export async function changeUserPassword(
  app: FastifyInstance,
  id: string,
  input: ChangeUserPasswordRequest,
  actor: { sub: string; role: UserRole },
): Promise<UserResponse> {
  const prisma = getPrisma(app);

  const existing = await prisma.user.findUnique({
    where: { id },
  });

  if (!existing) {
    throw createHttpError(404, "User not found");
  }

  assertCanActOnUser(actor, { id: existing.id, role: existing.role });
  assertNotDemoAccount(existing);

  const passwordHash = await bcrypt.hash(input.password, env.bcryptSaltRounds);

  const user = await prisma.user.update({
    where: { id },
    data: {
      passwordHash,
      refreshTokenHash: null,
      sessions: { updateMany: { where: { revokedAt: null }, data: { revokedAt: new Date() } } },
      lockUntil: null,
      failedLoginAttempts: 0,
    },
  });

  return normalizeUser(user);
}

export async function changeUserRole(
  app: FastifyInstance,
  id: string,
  input: ChangeUserRoleRequest,
  actor: { sub: string; role: UserRole },
): Promise<UserResponse> {
  const prisma = getPrisma(app);

  const existing = await prisma.user.findUnique({
    where: { id },
  });

  if (!existing) {
    throw createHttpError(404, "User not found");
  }

  assertCanActOnUser(actor, { id: existing.id, role: existing.role });
  assertNotDemoAccount(existing);

  // Granting a role you do not hold yourself would be an escalation, and
  // changing your own role could strip the last owner out of the system.
  assertCanActOnUser(actor, { id: existing.id, role: input.role });

  if (actor.sub === id && input.role !== existing.role) {
    throw createHttpError(403, "You cannot change your own role");
  }

  if (existing.role === "owner" && input.role !== "owner") {
    if (await isLastActiveOwner(prisma, id)) {
      throw createHttpError(409, "Cannot demote the last active owner");
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      role: input.role,
    },
  });

  return normalizeUser(user);
}

export async function archiveUser(
  app: FastifyInstance,
  id: string,
  actor: { sub: string; role: UserRole },
): Promise<UserResponse> {
  const prisma = getPrisma(app);

  const existing = await prisma.user.findUnique({
    where: { id },
  });

  if (!existing) {
    throw createHttpError(404, "User not found");
  }

  assertCanActOnUser(actor, { id: existing.id, role: existing.role });
  assertNotDemoAccount(existing);

  if (actor.sub === id) {
    throw createHttpError(403, "You cannot archive your own account");
  }

  if (existing.status === "inactive") {
    throw createHttpError(409, "User is already archived");
  }

  if (existing.role === "owner" && (await isLastActiveOwner(prisma, id))) {
    throw createHttpError(409, "Cannot archive the last active owner");
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      status: "inactive",
      refreshTokenHash: null,
      sessions: { updateMany: { where: { revokedAt: null }, data: { revokedAt: new Date() } } },
      lockUntil: null,
      failedLoginAttempts: 0,
    },
  });

  return normalizeUser(user);
}

/**
 * Changing your own password.
 *
 * Requires the current password, so someone who walks up to an unlocked device
 * cannot lock the real user out of their own account. Every session is revoked
 * afterwards, which signs out any device still holding the old credentials.
 */
export async function changeOwnPassword(
  app: FastifyInstance,
  userId: string,
  input: { currentPassword: string; newPassword: string },
): Promise<{ success: true }> {
  const prisma = getPrisma(app);

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw createHttpError(401, "Unauthorized");
  }

  const currentPasswordValid = await bcrypt.compare(input.currentPassword, user.passwordHash);

  if (!currentPasswordValid) {
    throw createHttpError(400, "Your current password is incorrect");
  }

  if (await bcrypt.compare(input.newPassword, user.passwordHash)) {
    throw createHttpError(400, "Choose a password you have not used before");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, env.bcryptSaltRounds);

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      refreshTokenHash: null,
      sessions: { updateMany: { where: { revokedAt: null }, data: { revokedAt: new Date() } } },
      lockUntil: null,
      failedLoginAttempts: 0,
    },
  });

  return { success: true };
}

export async function restoreUser(
  app: FastifyInstance,
  id: string,
  actor: { sub: string; role: UserRole },
): Promise<UserResponse> {
  const prisma = getPrisma(app);

  const existing = await prisma.user.findUnique({
    where: { id },
  });

  if (!existing) {
    throw createHttpError(404, "User not found");
  }

  assertCanActOnUser(actor, { id: existing.id, role: existing.role });
  assertNotDemoAccount(existing);

  if (existing.status === "active") {
    throw createHttpError(409, "User is already active");
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      status: "active",
      lockUntil: null,
      failedLoginAttempts: 0,
    },
  });

  return normalizeUser(user);
}
