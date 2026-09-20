import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "@/app/middleware/authenticate";
import { requirePermission } from "@/app/middleware/authorize";
import { PERMISSIONS } from "@/app/auth/permissions";
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

  const canView = requirePermission(PERMISSIONS.CUSTOMER_VIEW);
  const canManageDeposit = requirePermission(PERMISSIONS.CUSTOMER_DEPOSIT_MANAGE);
  const canManageOpeningBalance = requirePermission(
    PERMISSIONS.CUSTOMER_OPENING_BALANCE_MANAGE,
  );

  app.get("/stats", { preHandler: canView }, getCustomerStatsHandler);
  app.get("/", { preHandler: canView }, getCustomersHandler);
  app.post(
    "/",
    { preHandler: requirePermission(PERMISSIONS.CUSTOMER_CREATE) },
    createCustomerHandler,
  );

  app.get("/lookup", { preHandler: canView }, getCustomerByCardNumberHandler);
  app.get("/:id", { preHandler: canView }, getCustomerByIdHandler);
  app.patch(
    "/:id",
    { preHandler: requirePermission(PERMISSIONS.CUSTOMER_UPDATE) },
    updateCustomerHandler,
  );

  app.post("/:id/deposits/top-up", { preHandler: canManageDeposit }, topUpDepositHandler);
  app.post("/:id/deposits/refund", { preHandler: canManageDeposit }, refundDepositHandler);

  app.get("/:id/statement", { preHandler: canView }, getCustomerStatementHandler);

  app.get("/:id/opening-balance", { preHandler: canView }, getOpeningBalanceHandler);
  app.post(
    "/:id/opening-balance",
    { preHandler: canManageOpeningBalance },
    setOpeningBalanceHandler,
  );
  app.delete(
    "/:id/opening-balance",
    { preHandler: canManageOpeningBalance },
    removeOpeningBalanceHandler,
  );

  const canArchive = requirePermission(PERMISSIONS.CUSTOMER_ARCHIVE);
  app.patch("/:id/archive", { preHandler: canArchive }, archiveCustomerHandler);
  app.patch("/:id/restore", { preHandler: canArchive }, restoreCustomerHandler);

  app.get("/:id/card-assignment", { preHandler: canView }, getCustomerCardAssignmentHandler);
  app.get("/:id/card-history", { preHandler: canView }, getCustomerCardHistoryHandler);
  app.get("/:id/bills", { preHandler: canView }, getCustomerBillsHandler);
  app.get("/:id/payments", { preHandler: canView }, getCustomerPaymentsHandler);
  app.get("/:id/audit-logs", { preHandler: canView }, getCustomerAuditLogsHandler);
  app.get("/:id/daily-history", { preHandler: canView }, getCustomerDailyHistoryHandler);
};
