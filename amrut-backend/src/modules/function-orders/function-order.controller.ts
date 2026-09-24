import type { FastifyReply, FastifyRequest } from "fastify";
import {
  createFunctionOrderSchema,
  functionOrderIdParamSchema,
  functionOrderListQuerySchema,
  updateFunctionOrderSchema,
} from "./function-order.schema";
import {
  createFunctionOrder,
  deleteFunctionOrder,
  getFunctionOrder,
  getFunctionOrderAuditLogs,
  getFunctionOrderPreparation,
  listFunctionOrders,
  updateFunctionOrder,
} from "./function-order.service";
import { functionOrderReminderQuerySchema } from "./function-order.schema";
import { env } from "@/config/env";

const userId = (request: FastifyRequest) => {
  const id = (request.user as { sub?: string }).sub;
  if (!id) throw new Error("Unauthorized");
  return id;
};
export async function createFunctionOrderHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply
    .status(201)
    .send(
      await createFunctionOrder(
        request.server,
        userId(request),
        createFunctionOrderSchema.parse(request.body),
      ),
    );
}
export async function listFunctionOrdersHandler(request: FastifyRequest) {
  return listFunctionOrders(request.server, functionOrderListQuerySchema.parse(request.query));
}
export async function getFunctionOrderHandler(request: FastifyRequest) {
  return getFunctionOrder(request.server, functionOrderIdParamSchema.parse(request.params).id);
}
export async function updateFunctionOrderHandler(request: FastifyRequest) {
  return updateFunctionOrder(
    request.server,
    functionOrderIdParamSchema.parse(request.params).id,
    userId(request),
    updateFunctionOrderSchema.parse(request.body),
  );
}
export async function deleteFunctionOrderHandler(request: FastifyRequest, reply: FastifyReply) {
  await deleteFunctionOrder(
    request.server,
    functionOrderIdParamSchema.parse(request.params).id,
    userId(request),
  );
  return reply.status(204).send();
}
export async function getFunctionOrderAuditLogsHandler(request: FastifyRequest) {
  return getFunctionOrderAuditLogs(
    request.server,
    functionOrderIdParamSchema.parse(request.params).id,
  );
}
export async function getFunctionOrderRemindersHandler(request: FastifyRequest) {
  const { daysAhead } = functionOrderReminderQuerySchema.parse(request.query);

  return getFunctionOrderPreparation(request.server, daysAhead ?? env.functionReminderDaysAhead);
}
