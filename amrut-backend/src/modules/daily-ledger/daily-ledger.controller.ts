import type { FastifyReply, FastifyRequest } from "fastify";
import {
  addDailyLedgerEntrySchema,
  createDailyLedgerSchema,
  dailyLedgerDateParamSchema,
  setNoPurchaseSchema,
  dailyLedgerEntryParamSchema,
  dailyLedgerListQuerySchema,
  customerIdParamSchema,
  updateDailyLedgerEntrySchema,
} from "./daily-ledger.schema";
import {
  addLedgerEntry,
  setLedgerNoPurchase,
  createTodayLedger,
  deleteLedgerEntry,
  getCustomerLedgerSummary,
  getCustomerLedgers,
  getLastLedgerEntry,
  getLedgerByDate,
  getTodayLedger,
  updateLedgerEntry,
} from "./daily-ledger.service";
import { getCurrentUserId } from "@/app/middleware/authorize";

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
export async function getLastLedgerEntryHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const result = await getLastLedgerEntry(request.server);

  return reply.send(result);
}

export async function setNoPurchaseHandler(request: FastifyRequest, reply: FastifyReply) {
  const { customerId, date } = dailyLedgerDateParamSchema.parse(request.params);
  const body = setNoPurchaseSchema.parse(request.body);

  return reply.send(
    await setLedgerNoPurchase(
      request.server,
      customerId,
      date,
      body.noPurchase,
      getCurrentUserId(request),
    ),
  );
}
