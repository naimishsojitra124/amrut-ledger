import type { FastifyReply, FastifyRequest } from "fastify";
import {
  customerIdParamSchema,
  archiveCustomerSchema,
  customerListQuerySchema,
  customerCardLookupQuerySchema,
  customerPageQuerySchema,
  updateCustomerSchema,
  createCustomerSchema,
  customerMonthQuerySchema,
  depositTransactionSchema,
} from "./customer.schema";
import {
  archiveCustomer,
  createCustomer,
  getCustomerAuditLogs,
  getCustomerBills,
  getCustomerByCardNumber,
  getCustomerById,
  getCustomerCardAssignment,
  getCustomerCardHistory,
  getCustomerDailyHistory,
  getCustomerPayments,
  getCustomerStats,
  getCustomers,
  restoreCustomer,
  updateCustomer,
  topUpDeposit,
  refundDeposit,
  getCustomerStatement,
} from "./customer.service";

function getCurrentUserId(request: FastifyRequest) {
  const user = request.user as { sub?: string };
  if (!user?.sub) {
    throw new Error("Unauthorized");
  }
  return user.sub;
}

export async function topUpDepositHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = customerIdParamSchema.parse(request.params);
  const body = depositTransactionSchema.parse(request.body);
  return reply
    .status(201)
    .send(await topUpDeposit(request.server, id, body, getCurrentUserId(request)));
}

export async function refundDepositHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = customerIdParamSchema.parse(request.params);
  const body = depositTransactionSchema.parse(request.body);
  return reply
    .status(201)
    .send(await refundDeposit(request.server, id, body, getCurrentUserId(request)));
}

export async function getCustomerStatementHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = customerIdParamSchema.parse(request.params);
  return reply.send(await getCustomerStatement(request.server, id));
}

export async function getCustomersHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = customerListQuerySchema.parse(request.query);
  const result = await getCustomers(request.server, query);

  return reply.send(result);
}

export async function getCustomerStatsHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await getCustomerStats(request.server);
  return reply.send(result);
}

export async function getCustomerByCardNumberHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = customerCardLookupQuerySchema.parse(request.query);
  const result = await getCustomerByCardNumber(request.server, query.cardNumber);

  return reply.send(result);
}

export async function getCustomerByIdHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = customerIdParamSchema.parse(request.params);
  const result = await getCustomerById(request.server, params.id);

  return reply.send(result);
}

export async function createCustomerHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createCustomerSchema.parse(request.body);
  const result = await createCustomer(request.server, body, getCurrentUserId(request));

  return reply.status(201).send(result);
}

export async function updateCustomerHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = customerIdParamSchema.parse(request.params);
  const body = updateCustomerSchema.parse(request.body);
  const result = await updateCustomer(request.server, params.id, body, getCurrentUserId(request));

  return reply.send(result);
}

export async function archiveCustomerHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = customerIdParamSchema.parse(request.params);
  const body = archiveCustomerSchema.parse(request.body ?? {});
  const result = await archiveCustomer(
    request.server,
    params.id,
    getCurrentUserId(request),
    body.refundDeposit,
  );

  return reply.send(result);
}

export async function restoreCustomerHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = customerIdParamSchema.parse(request.params);
  const result = await restoreCustomer(request.server, params.id, getCurrentUserId(request));

  return reply.send(result);
}

export async function getCustomerCardAssignmentHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = customerIdParamSchema.parse(request.params);
  const result = await getCustomerCardAssignment(request.server, params.id);

  return reply.send(result);
}

export async function getCustomerCardHistoryHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = customerIdParamSchema.parse(request.params);
  const result = await getCustomerCardHistory(request.server, params.id);

  return reply.send(result);
}

export async function getCustomerBillsHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = customerIdParamSchema.parse(request.params);
  const query = customerListQuerySchema.parse(request.query);
  const result = await getCustomerBills(request.server, params.id, query);

  return reply.send(result);
}

export async function getCustomerPaymentsHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = customerIdParamSchema.parse(request.params);
  const query = customerListQuerySchema.parse(request.query);
  const result = await getCustomerPayments(request.server, params.id, query);

  return reply.send(result);
}

export async function getCustomerAuditLogsHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = customerIdParamSchema.parse(request.params);
  const query = customerPageQuerySchema.parse(request.query);
  const result = await getCustomerAuditLogs(
    request.server,
    params.id,
    query.types === undefined
      ? { page: query.page, limit: query.limit }
      : { page: query.page, limit: query.limit, types: query.types },
  );

  return reply.send(result);
}

export async function getCustomerDailyHistoryHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = customerIdParamSchema.parse(request.params);
  const query = customerMonthQuerySchema.parse(request.query);
  const result = await getCustomerDailyHistory(request.server, params.id, query);

  return reply.send(result);
}
