import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "@/app/middleware/authenticate";
import { requirePermission } from "@/app/middleware/authorize";
import { PERMISSIONS } from "@/app/auth/permissions";
import {
  archiveMilkTypeHandler,
  createMilkTypeHandler,
  getActiveMilkTypesHandler,
  getMilkTypeByIdHandler,
  getMilkTypesHandler,
  restoreMilkTypeHandler,
  updateMilkTypeHandler,
} from "./milk-type.controller";

export const milkTypeRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  const canView = requirePermission(PERMISSIONS.MILK_TYPE_VIEW);
  const canManage = requirePermission(PERMISSIONS.MILK_TYPE_MANAGE);

  app.get("/active", { preHandler: canView }, getActiveMilkTypesHandler);
  app.get("/", { preHandler: canView }, getMilkTypesHandler);
  app.post("/", { preHandler: canManage }, createMilkTypeHandler);

  app.get("/:id", { preHandler: canView }, getMilkTypeByIdHandler);
  app.patch("/:id", { preHandler: canManage }, updateMilkTypeHandler);
  app.patch("/:id/archive", { preHandler: canManage }, archiveMilkTypeHandler);
  app.patch("/:id/restore", { preHandler: canManage }, restoreMilkTypeHandler);
};
