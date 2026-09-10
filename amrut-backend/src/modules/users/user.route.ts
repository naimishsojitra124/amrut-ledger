import type { FastifyPluginAsync } from "fastify";
import { authorizeRoles } from "@/app/middleware/authorize";
import {
  archiveUserHandler,
  changeUserPasswordHandler,
  changeUserRoleHandler,
  createUserHandler,
  getUserByIdHandler,
  getUserStatsHandler,
  getUsersHandler,
  restoreUserHandler,
  updateUserHandler,
} from "./user.controller";

export const userRoutes: FastifyPluginAsync = async (app) => {
  app.get("/stats", { preHandler: authorizeRoles("owner", "manager") }, getUserStatsHandler);
  app.get("/", { preHandler: authorizeRoles("owner", "manager") }, getUsersHandler);
  app.get("/:id", { preHandler: authorizeRoles("owner", "manager") }, getUserByIdHandler);

  app.post("/", { preHandler: authorizeRoles("owner") }, createUserHandler);
  app.patch("/:id", { preHandler: authorizeRoles("owner") }, updateUserHandler);
  app.patch("/:id/password", { preHandler: authorizeRoles("owner", "manager") }, changeUserPasswordHandler);
  app.patch("/:id/role", { preHandler: authorizeRoles("owner") }, changeUserRoleHandler);
  app.patch("/:id/archive", { preHandler: authorizeRoles("owner") }, archiveUserHandler);
  app.patch("/:id/restore", { preHandler: authorizeRoles("owner") }, restoreUserHandler);
};