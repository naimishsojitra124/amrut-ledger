import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "../../../generated/prisma/enums";
import {
  canActOnUser,
  roleHasPermission,
  type Permission,
} from "@/app/auth/permissions";
import { createHttpError } from "@/app/http-error";

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

  throw createHttpError(
    403,
    "The shared demo account cannot be changed. Try it on one of the other accounts.",
  );
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

export function getRequestActor(request: FastifyRequest) {
  const actor = getActor(request);
  if (!actor) throw createHttpError(401, "Unauthorized");
  return actor;
}

// Holding the permission is not enough; seniority decides whose account you may touch.
export function assertCanActOnUser(
  actor: { sub: string; role: UserRole },
  target: { id: string; role: UserRole },
) {
  const isSelf = actor.sub === target.id;

  if (isSelf || canActOnUser(actor.role, target.role)) return;

  throw createHttpError(403, "You cannot change an account at or above your own level.");
}

// The four controllers each had a copy of this that threw a bare Error, which the global
// handler could only report as a 500.
export const getCurrentUserId = (request: FastifyRequest) => getRequestActor(request).sub;
