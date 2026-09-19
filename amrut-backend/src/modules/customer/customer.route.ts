import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "@/app/middleware/authenticate";
import { authorizeDepositCorrection, authorizeRoles } from "@/app/middleware/authorize";
import {
  archiveCustomerHandler,
  createCustomerHandler,
  getCustomerAuditLogsHandler,
  getCustomerBillsHandler,
  getCustomerByCardNumberHandler,
  getCustomerByIdHandler,
  getCustomerCardAssignmentHandler,
  getCustomerCardHistoryHandler,
  getCustomerDailyHistoryHandler,
  getCustomerPaymentsHandler,
  getCustomerStatsHandler,
  getCustomersHandler,
  restoreCustomerHandler,
  updateCustomerHandler,
  topUpDepositHandler,
  refundDepositHandler,
  getCustomerStatementHandler,
  getOpeningBalanceHandler,
  setOpeningBalanceHandler,
  removeOpeningBalanceHandler,
} from "./customer.controller";

export const customerRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  app.get("/stats", getCustomerStatsHandler);
  app.get("/", getCustomersHandler);
  app.post("/", createCustomerHandler);

  app.get("/lookup", getCustomerByCardNumberHandler);
  app.get("/:id", getCustomerByIdHandler);
  app.patch("/:id", { preHandler: authorizeDepositCorrection }, updateCustomerHandler);
  app.post("/:id/deposits/top-up", { preHandler: authorizeRoles("owner", "manager") }, topUpDepositHandler);
  app.post("/:id/deposits/refund", { preHandler: authorizeRoles("owner", "manager") }, refundDepositHandler);
  app.get("/:id/statement", getCustomerStatementHandler);

  // Opening balances only exist while migrating off paper records, so changing
  // one is restricted to the roles that can already correct money.
  app.get("/:id/opening-balance", getOpeningBalanceHandler);
  app.post(
    "/:id/opening-balance",
    { preHandler: authorizeRoles("owner", "manager") },
    setOpeningBalanceHandler,
  );
  app.delete(
    "/:id/opening-balance",
    { preHandler: authorizeRoles("owner", "manager") },
    removeOpeningBalanceHandler,
  );
  app.patch("/:id/archive", { preHandler: authorizeRoles("owner", "manager") }, archiveCustomerHandler);
  app.patch("/:id/restore", { preHandler: authorizeRoles("owner", "manager") }, restoreCustomerHandler);

  app.get("/:id/card-assignment", getCustomerCardAssignmentHandler);
  app.get("/:id/card-history", getCustomerCardHistoryHandler);
  app.get("/:id/bills", getCustomerBillsHandler);
  app.get("/:id/payments", getCustomerPaymentsHandler);
  app.get("/:id/audit-logs", getCustomerAuditLogsHandler);
  app.get("/:id/daily-history", getCustomerDailyHistoryHandler);
};
