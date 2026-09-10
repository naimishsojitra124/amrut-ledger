import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "@/app/middleware/authenticate";
import {
  addLedgerEntryHandler,
  createTodayLedgerHandler,
  deleteLedgerEntryHandler,
  getCustomerLedgerSummaryHandler,
  getCustomerLedgersHandler,
  getLedgerByDateHandler,
  getTodayLedgerHandler,
  updateLedgerEntryHandler,
} from "./daily-ledger.controller";

export const dailyLedgerRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  app.post("/:customerId/ledgers/today", createTodayLedgerHandler);
  app.get("/:customerId/ledgers/today", getTodayLedgerHandler);

  app.get("/:customerId/ledgers", getCustomerLedgersHandler);
  app.get("/:customerId/ledgers/summary", getCustomerLedgerSummaryHandler);
  app.get("/:customerId/ledgers/:date", getLedgerByDateHandler);

  app.post("/:customerId/ledgers/:date/entries", addLedgerEntryHandler);
  app.patch("/:customerId/ledgers/:date/entries/:entryIndex", updateLedgerEntryHandler);
  app.delete("/:customerId/ledgers/:date/entries/:entryIndex", deleteLedgerEntryHandler);
};