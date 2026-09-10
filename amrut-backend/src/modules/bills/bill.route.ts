import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "@/app/middleware/authenticate";
import { authorizeRoles } from "@/app/middleware/authorize";
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

  app.get("/bills/summary", getBillsSummaryHandler);
  app.get("/bills/overdue", getOverdueBillsHandler);
  app.get("/bills", getBillsHandler);
  app.get("/bills/:billId", getBillByIdHandler);
  app.get("/bills/:billId/payments", getBillPaymentsHandler);

  app.get("/customers/:customerId/bills/:year/:month", getCustomerBillByMonthHandler);

  app.get("/payments/summary", getPaymentsSummaryHandler);
  app.get("/payments", getPaymentsHandler);
  app.get("/payments/:paymentId", getPaymentByIdHandler);

  app.post("/customers/:customerId/bills", { preHandler: authorizeRoles("owner", "manager") }, generateBillHandler);

  app.post("/payments", recordPaymentHandler);
  app.post("/payments/:paymentId/reverse", { preHandler: authorizeRoles("owner", "manager") }, reversePaymentHandler);
};
