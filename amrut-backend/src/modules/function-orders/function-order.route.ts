import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "@/app/middleware/authenticate";
import { requirePermission } from "@/app/middleware/authorize";
import { PERMISSIONS } from "@/app/auth/permissions";
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

  const canView = requirePermission(PERMISSIONS.FUNCTION_ORDER_VIEW);

  app.get("/reminders", { preHandler: canView }, getFunctionOrderRemindersHandler);
  app.get("/", { preHandler: canView }, listFunctionOrdersHandler);
  app.post(
    "/",
    { preHandler: requirePermission(PERMISSIONS.FUNCTION_ORDER_CREATE) },
    createFunctionOrderHandler,
  );
  app.get("/:id", { preHandler: canView }, getFunctionOrderHandler);
  app.get("/:id/audit-logs", { preHandler: canView }, getFunctionOrderAuditLogsHandler);
  app.patch(
    "/:id",
    { preHandler: requirePermission(PERMISSIONS.FUNCTION_ORDER_UPDATE) },
    updateFunctionOrderHandler,
  );
  app.delete(
    "/:id",
    { preHandler: requirePermission(PERMISSIONS.FUNCTION_ORDER_DELETE) },
    deleteFunctionOrderHandler,
  );
};
