import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "@/app/middleware/authenticate";
import { authorizeRoles } from "@/app/middleware/authorize";
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

  app.get("/active", getActiveMilkTypesHandler);
  app.get("/", getMilkTypesHandler);
  app.post("/", { preHandler: authorizeRoles("owner", "manager") }, createMilkTypeHandler);

  app.get("/:id", getMilkTypeByIdHandler);
  app.patch("/:id", { preHandler: authorizeRoles("owner", "manager") }, updateMilkTypeHandler);
  app.patch("/:id/archive", { preHandler: authorizeRoles("owner", "manager") }, archiveMilkTypeHandler);
  app.patch("/:id/restore", { preHandler: authorizeRoles("owner", "manager") }, restoreMilkTypeHandler);
};
