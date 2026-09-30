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
import { recalculateBillForPeriod } from "@/modules/bills/bill.service";
import type { BillRecalculationResult } from "@/modules/bills/bill.types";

export async function createTodayLedgerHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = customerIdParamSchema.parse(request.params);
  const body = createDailyLedgerSchema.parse(request.body);
  const performedById = getCurrentUserId(request);

  const result = await createTodayLedger(request.server, params.customerId, performedById, body);

  return reply.status(201).send(result);
}

export async function getTodayLedgerHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = customerIdParamSchema.parse(request.params);
  const result = await getTodayLedger(request.server, params.customerId);

  return reply.send(result);
}

export async function getLedgerByDateHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = dailyLedgerDateParamSchema.parse(request.params);
  const result = await getLedgerByDate(request.server, params.customerId, params.date);

  return reply.send(result);
}

export async function getCustomerLedgersHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = customerIdParamSchema.parse(request.params);
  const query = dailyLedgerListQuerySchema.parse(request.query);

  const result = await getCustomerLedgers(request.server, params.customerId, query);

  return reply.send(result);
}

export async function getCustomerLedgerSummaryHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = customerIdParamSchema.parse(request.params);
  const query = dailyLedgerListQuerySchema.parse(request.query);

  const result = await getCustomerLedgerSummary(request.server, params.customerId, query);

  return reply.send(result);
}

/**
 * A bill for the month an entry belongs to is a snapshot that has just gone out of date.
 *
 * Best effort on purpose: the entry is already saved by this point, and failing the
 * request here would throw away a correction someone made at month end. A failure is
 * logged loudly instead, and the ledger screen compares its own month total against the
 * bill, so a bill that did not catch up is still visible rather than silently wrong.
 */
async function syncBillAfterLedgerChange(
  request: FastifyRequest,
  customerId: string,
  date: string,
  performedById: string,
): Promise<BillRecalculationResult | undefined> {
  const [year, month] = date.slice(0, 10).split("-").map(Number);

  if (!year || !month) return undefined;

  try {
    return await recalculateBillForPeriod(request.server, customerId, month, year, performedById);
  } catch (error) {
    request.log.error(
      { err: error, customerId, month, year },
      "bill recalculation after a ledger change failed",
    );

    return undefined;
  }
}

export async function addLedgerEntryHandler(request: FastifyRequest, reply: FastifyReply) {
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

  const billUpdate = await syncBillAfterLedgerChange(
    request,
    params.customerId,
    params.date,
    performedById,
  );

  return reply.send({ ...result, billUpdate });
}

export async function updateLedgerEntryHandler(request: FastifyRequest, reply: FastifyReply) {
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

  const billUpdate = await syncBillAfterLedgerChange(
    request,
    params.customerId,
    params.date,
    performedById,
  );

  return reply.send({ ...result, billUpdate });
}

export async function deleteLedgerEntryHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = dailyLedgerEntryParamSchema.parse(request.params);
  const performedById = getCurrentUserId(request);

  const result = await deleteLedgerEntry(
    request.server,
    params.customerId,
    performedById,
    params.date,
    params.entryId,
  );

  const billUpdate = await syncBillAfterLedgerChange(
    request,
    params.customerId,
    params.date,
    performedById,
  );

  return reply.send({ ...result, billUpdate });
}
export async function getLastLedgerEntryHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await getLastLedgerEntry(request.server);

  return reply.send(result);
}

export async function setNoPurchaseHandler(request: FastifyRequest, reply: FastifyReply) {
  const { customerId, date } = dailyLedgerDateParamSchema.parse(request.params);
  const body = setNoPurchaseSchema.parse(request.body);

  const performedById = getCurrentUserId(request);

  const result = await setLedgerNoPurchase(
    request.server,
    customerId,
    date,
    body.noPurchase,
    performedById,
  );

  const billUpdate = await syncBillAfterLedgerChange(request, customerId, date, performedById);

  return reply.send({ ...result, billUpdate });
}
