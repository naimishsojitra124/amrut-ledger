import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "@/app/middleware/authenticate";
import { authorizeRoles } from "@/app/middleware/authorize";
import {
  createFunctionOrderHandler,
  deleteFunctionOrderHandler,
  getFunctionOrderAuditLogsHandler,
  getFunctionOrderHandler,
  getFunctionOrderRemindersHandler,
  listFunctionOrdersHandler,
  updateFunctionOrderHandler,
} from "./function-order.controller";

export const functionOrderRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);
  app.get("/reminders", getFunctionOrderRemindersHandler);
  app.get("/", listFunctionOrdersHandler);
  app.post("/", createFunctionOrderHandler);
  app.get("/:id", getFunctionOrderHandler);
  app.get("/:id/audit-logs", getFunctionOrderAuditLogsHandler);
  app.patch("/:id", updateFunctionOrderHandler);
  app.delete("/:id", { preHandler: authorizeRoles("owner", "manager") }, deleteFunctionOrderHandler);
};
