import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "@/app/middleware/authenticate";
import { requirePermission } from "@/app/middleware/authorize";
import { PERMISSIONS } from "@/app/auth/permissions";
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

  const canView = requirePermission(PERMISSIONS.LEDGER_VIEW);
  const canCreate = requirePermission(PERMISSIONS.LEDGER_ENTRY_CREATE);

  app.post("/:customerId/ledgers/today", { preHandler: canCreate }, createTodayLedgerHandler);
  app.get("/:customerId/ledgers/today", { preHandler: canView }, getTodayLedgerHandler);

  app.get("/:customerId/ledgers", { preHandler: canView }, getCustomerLedgersHandler);
  app.get(
    "/:customerId/ledgers/summary",
    { preHandler: canView },
    getCustomerLedgerSummaryHandler,
  );
  app.get("/:customerId/ledgers/:date", { preHandler: canView }, getLedgerByDateHandler);

  app.post("/:customerId/ledgers/:date/entries", { preHandler: canCreate }, addLedgerEntryHandler);

  // Addressed by entry id rather than array position — see the schema.
  app.patch(
    "/:customerId/ledgers/:date/entries/:entryId",
    { preHandler: requirePermission(PERMISSIONS.LEDGER_ENTRY_UPDATE) },
    updateLedgerEntryHandler,
  );
  app.delete(
    "/:customerId/ledgers/:date/entries/:entryId",
    { preHandler: requirePermission(PERMISSIONS.LEDGER_ENTRY_DELETE) },
    deleteLedgerEntryHandler,
  );
};