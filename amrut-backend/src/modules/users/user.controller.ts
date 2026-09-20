import type { FastifyReply, FastifyRequest } from "fastify";
import { getRequestActor } from "@/app/middleware/authorize";
import {
  archiveUser,
  changeOwnPassword,
  changeUserPassword,
  changeUserRole,
  createUser,
  getUserById,
  getUserStats,
  getUsers,
  restoreUser,
  updateUser,
} from "./user.service";
import {
  changeOwnPasswordSchema,
  changeUserPasswordSchema,
  changeUserRoleSchema,
  createUserSchema,
  userIdParamSchema,
  userListQuerySchema,
  updateUserSchema,
} from "./user.schema";

export async function getUsersHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = userListQuerySchema.parse(request.query);
  const result = await getUsers(request.server, query);

  return reply.send(result);
}

export async function getUserStatsHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await getUserStats(request.server);

  return reply.send(result);
}

export async function getUserByIdHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = userIdParamSchema.parse(request.params);
  const result = await getUserById(request.server, params.id);

  return reply.send(result);
}

export async function createUserHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createUserSchema.parse(request.body);
  const result = await createUser(request.server, body, getRequestActor(request));

  return reply.status(201).send(result);
}

export async function updateUserHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = userIdParamSchema.parse(request.params);
  const body = updateUserSchema.parse(request.body);
  const result = await updateUser(
    request.server,
    params.id,
    body,
    getRequestActor(request),
  );

  return reply.send(result);
}

export async function changeUserPasswordHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = userIdParamSchema.parse(request.params);
  const body = changeUserPasswordSchema.parse(request.body);
  const result = await changeUserPassword(
    request.server,
    params.id,
    body,
    getRequestActor(request),
  );

  return reply.send(result);
}

/** Self-service password change; requires the current password. */
export async function changeOwnPasswordHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = changeOwnPasswordSchema.parse(request.body);
  const actor = getRequestActor(request);

  return reply.send(await changeOwnPassword(request.server, actor.sub, body));
}

export async function changeUserRoleHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = userIdParamSchema.parse(request.params);
  const body = changeUserRoleSchema.parse(request.body);
  const result = await changeUserRole(
    request.server,
    params.id,
    body,
    getRequestActor(request),
  );

  return reply.send(result);
}

export async function archiveUserHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = userIdParamSchema.parse(request.params);
  const result = await archiveUser(request.server, params.id, getRequestActor(request));

  return reply.send(result);
}

export async function restoreUserHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = userIdParamSchema.parse(request.params);
  const result = await restoreUser(request.server, params.id, getRequestActor(request));

  return reply.send(result);
}