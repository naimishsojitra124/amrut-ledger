import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "@/app/middleware/authenticate";
import { requirePermission } from "@/app/middleware/authorize";
import { PERMISSIONS } from "@/app/auth/permissions";
import {
  generateBillHandler,
  getBillByIdHandler,
  getBillPaymentsHandler,
  getBillsHandler,
  getBillsSummaryHandler,
  getCustomerBillByMonthHandler,
  getPaymentByIdHandler,
  getPaymentsHandler,
  getPaymentsSummaryHandler,
  getOverdueBillsHandler,
  recordPaymentHandler,
  reversePaymentHandler,
} from "./bill.controller";

export const billRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  const canViewBills = requirePermission(PERMISSIONS.BILL_VIEW);
  const canViewPayments = requirePermission(PERMISSIONS.PAYMENT_VIEW);

  app.get("/bills/summary", { preHandler: canViewBills }, getBillsSummaryHandler);
  app.get("/bills/overdue", { preHandler: canViewBills }, getOverdueBillsHandler);
  app.get("/bills", { preHandler: canViewBills }, getBillsHandler);
  app.get("/bills/:billId", { preHandler: canViewBills }, getBillByIdHandler);
  app.get("/bills/:billId/payments", { preHandler: canViewPayments }, getBillPaymentsHandler);

  app.get(
    "/customers/:customerId/bills/:year/:month",
    { preHandler: canViewBills },
    getCustomerBillByMonthHandler,
  );

  app.get("/payments/summary", { preHandler: canViewPayments }, getPaymentsSummaryHandler);
  app.get("/payments", { preHandler: canViewPayments }, getPaymentsHandler);
  app.get("/payments/:paymentId", { preHandler: canViewPayments }, getPaymentByIdHandler);

  app.post(
    "/customers/:customerId/bills",
    { preHandler: requirePermission(PERMISSIONS.BILL_GENERATE) },
    generateBillHandler,
  );

  app.post(
    "/payments",
    { preHandler: requirePermission(PERMISSIONS.PAYMENT_RECORD) },
    recordPaymentHandler,
  );
  app.post(
    "/payments/:paymentId/reverse",
    { preHandler: requirePermission(PERMISSIONS.PAYMENT_REVERSE) },
    reversePaymentHandler,
  );
};
