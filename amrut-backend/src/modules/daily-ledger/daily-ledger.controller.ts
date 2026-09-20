import type { FastifyReply, FastifyRequest } from "fastify";
import {
  addDailyLedgerEntrySchema,
  createDailyLedgerSchema,
  dailyLedgerDateParamSchema,
  dailyLedgerEntryParamSchema,
  dailyLedgerListQuerySchema,
  customerIdParamSchema,
  updateDailyLedgerEntrySchema,
} from "./daily-ledger.schema";
import {
  addLedgerEntry,
  createTodayLedger,
  deleteLedgerEntry,
  getCustomerLedgerSummary,
  getCustomerLedgers,
  getLedgerByDate,
  getTodayLedger,
  updateLedgerEntry,
} from "./daily-ledger.service";

function getCurrentUserId(request: FastifyRequest) {
  const user = request.user as { sub?: string };
  if (!user?.sub) {
    throw new Error("Unauthorized");
  }
  return user.sub;
}

export async function createTodayLedgerHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = customerIdParamSchema.parse(request.params);
  const body = createDailyLedgerSchema.parse(request.body);
  const performedById = getCurrentUserId(request);

  const result = await createTodayLedger(
    request.server,
    params.customerId,
    performedById,
    body,
  );

  return reply.status(201).send(result);
}

export async function getTodayLedgerHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = customerIdParamSchema.parse(request.params);
  const result = await getTodayLedger(request.server, params.customerId);

  return reply.send(result);
}

export async function getLedgerByDateHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = dailyLedgerDateParamSchema.parse(request.params);
  const result = await getLedgerByDate(
    request.server,
    params.customerId,
    params.date,
  );

  return reply.send(result);
}

export async function getCustomerLedgersHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = customerIdParamSchema.parse(request.params);
  const query = dailyLedgerListQuerySchema.parse(request.query);

  const result = await getCustomerLedgers(
    request.server,
    params.customerId,
    query,
  );

  return reply.send(result);
}

export async function getCustomerLedgerSummaryHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = customerIdParamSchema.parse(request.params);
  const query = dailyLedgerListQuerySchema.parse(request.query);

  const result = await getCustomerLedgerSummary(
    request.server,
    params.customerId,
    query,
  );

  return reply.send(result);
}

export async function addLedgerEntryHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = dailyLedgerDateParamSchema.parse(request.params);
  const body = addDailyLedgerEntrySchema.parse(request.body);
  const performedById = getCurrentUserId(request);

  const result = await addLedgerEntry(
    request.server,
    params.customerId,
    performedById,
    params.date,
    body,
  );

  return reply.send(result);
}

export async function updateLedgerEntryHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = dailyLedgerEntryParamSchema.parse(request.params);
  const body = updateDailyLedgerEntrySchema.parse(request.body);
  const performedById = getCurrentUserId(request);

  const result = await updateLedgerEntry(
    request.server,
    params.customerId,
    performedById,
    params.date,
    params.entryId,
    body,
  );

  return reply.send(result);
}

export async function deleteLedgerEntryHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = dailyLedgerEntryParamSchema.parse(request.params);
  const performedById = getCurrentUserId(request);

  const result = await deleteLedgerEntry(
    request.server,
    params.customerId,
    performedById,
    params.date,
    params.entryId,
  );

  return reply.send(result);
}