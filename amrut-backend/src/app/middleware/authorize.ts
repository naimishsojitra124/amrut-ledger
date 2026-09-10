import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "generated/prisma/enums";

export function authorizeRoles(...allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await request.jwtVerify();

    const user = request.user as { role: UserRole };

    if (!allowedRoles.includes(user.role)) {
      return reply.status(403).send({ message: "Forbidden" });
    }
  };
}

export async function authorizeDepositCorrection(request: FastifyRequest, reply: FastifyReply) {
  if (!(request.body && "depositAmount" in (request.body as object))) return;
  const user = request.user as { role: UserRole };
  if (!["owner", "manager"].includes(user.role)) return reply.status(403).send({ message: "Only owners and managers can correct a deposit" });
}
