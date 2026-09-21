import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "../../../generated/prisma/enums";
import {
  canActOnUser,
  roleHasPermission,
  type Permission,
} from "@/app/auth/permissions";

/**
 * Authorisation is enforced here, against the matrix in `app/auth/permissions`.
 *
 * Every protected route declares the permission it needs rather than listing
 * roles inline, so changing who can do what is a one-line edit in that file and
 * cannot leave a route behind.
 */

function getActor(request: FastifyRequest): { sub: string; role: UserRole } | null {
  const user = request.user as { sub?: string; role?: UserRole } | undefined;
  if (!user?.sub || !user.role) return null;
  return { sub: user.sub, role: user.role };
}

// Renaming, archiving or demoting the shared demo login would lock out the next visitor.
export function assertNotDemoAccount(target: { role: UserRole; mobileNumber?: string | null }) {
  if (target.role !== "guest") return;

  const error = new Error(
    "The shared demo account cannot be changed. Try it on one of the other accounts.",
  ) as Error & { statusCode: number };
  error.statusCode = 403;
  throw error;
}

// Verifies the token itself, so it works on routes that do not also run `authenticate`.
export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ message: "Unauthorized" });
    }

    const actor = getActor(request);

    if (!actor) {
      return reply.status(401).send({ message: "Unauthorized" });
    }

    if (!roleHasPermission(actor.role, permission)) {
      request.log.info(
        { role: actor.role, permission, path: request.routeOptions.url },
        "permission denied",
      );

      return reply.status(403).send({
        message: "You do not have permission to do that.",
      });
    }
  };
}

// Passes when the caller holds any one of the listed permissions
export function requireAnyPermission(...permissions: Permission[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ message: "Unauthorized" });
    }

    const actor = getActor(request);

    if (!actor) {
      return reply.status(401).send({ message: "Unauthorized" });
    }

    if (!permissions.some((permission) => roleHasPermission(actor.role, permission))) {
      return reply.status(403).send({
        message: "You do not have permission to do that.",
      });
    }
  };
}

export function getRequestActor(request: FastifyRequest) {
  const actor = getActor(request);
  if (!actor) {
    const error = new Error("Unauthorized") as Error & { statusCode: number };
    error.statusCode = 401;
    throw error;
  }
  return actor;
}

// Holding the permission is not enough; seniority decides whose account you may touch.
export function assertCanActOnUser(
  actor: { sub: string; role: UserRole },
  target: { id: string; role: UserRole },
) {
  const isSelf = actor.sub === target.id;

  if (isSelf || canActOnUser(actor.role, target.role)) return;

  const error = new Error(
    "You cannot change an account at or above your own level.",
  ) as Error & { statusCode: number };
  error.statusCode = 403;
  throw error;
}
