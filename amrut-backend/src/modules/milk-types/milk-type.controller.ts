import type { FastifyReply, FastifyRequest } from "fastify";
import {
  archiveMilkType,
  createMilkType,
  getActiveMilkTypes,
  getMilkTypeById,
  getMilkTypes,
  restoreMilkType,
  updateMilkType,
} from "./milk-type.service";
import {
  createMilkTypeSchema,
  milkTypeIdParamSchema,
  milkTypeListQuerySchema,
  updateMilkTypeSchema,
} from "./milk-type.schema";

export async function createMilkTypeHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createMilkTypeSchema.parse(request.body);
  const result = await createMilkType(request.server, body);

  return reply.status(201).send(result);
}

export async function getMilkTypesHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = milkTypeListQuerySchema.parse(request.query);
  const result = await getMilkTypes(request.server, query);

  return reply.send(result);
}

export async function getActiveMilkTypesHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await getActiveMilkTypes(request.server);

  return reply.send(result);
}

export async function getMilkTypeByIdHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = milkTypeIdParamSchema.parse(request.params);
  const result = await getMilkTypeById(request.server, params.id);

  return reply.send(result);
}

export async function updateMilkTypeHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = milkTypeIdParamSchema.parse(request.params);
  const body = updateMilkTypeSchema.parse(request.body);
  const result = await updateMilkType(request.server, params.id, body);

  return reply.send(result);
}

export async function archiveMilkTypeHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = milkTypeIdParamSchema.parse(request.params);
  const result = await archiveMilkType(request.server, params.id);

  return reply.send(result);
}

export async function restoreMilkTypeHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = milkTypeIdParamSchema.parse(request.params);
  const result = await restoreMilkType(request.server, params.id);

  return reply.send(result);
}
