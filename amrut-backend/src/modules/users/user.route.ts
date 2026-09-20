import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "@/app/middleware/authenticate";
import { requirePermission } from "@/app/middleware/authorize";
import { PERMISSIONS } from "@/app/auth/permissions";
import {
  archiveUserHandler,
  changeOwnPasswordHandler,
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
  app.addHook("preHandler", authenticate);

  /**
   * Changing your own password needs no permission — every signed-in user must
   * be able to rotate their own credentials — but it does require the current
   * one, so a borrowed session cannot lock the real owner out.
   *
   * Declared before "/:id/password" so it is not swallowed by that route.
   */
  app.patch("/me/password", changeOwnPasswordHandler);

  const canView = requirePermission(PERMISSIONS.USER_VIEW);

  app.get("/stats", { preHandler: canView }, getUserStatsHandler);
  app.get("/", { preHandler: canView }, getUsersHandler);
  app.get("/:id", { preHandler: canView }, getUserByIdHandler);

  app.post(
    "/",
    { preHandler: requirePermission(PERMISSIONS.USER_CREATE) },
    createUserHandler,
  );
  app.patch(
    "/:id",
    { preHandler: requirePermission(PERMISSIONS.USER_UPDATE) },
    updateUserHandler,
  );

  /**
   * Resetting someone else's password. The permission alone is not enough —
   * the handler also applies the seniority rule, so a manager can reset an
   * employee but never an owner or another manager. Without that, anyone who
   * could reset a password could simply take over the owner's account.
   */
  app.patch(
    "/:id/password",
    { preHandler: requirePermission(PERMISSIONS.USER_RESET_PASSWORD) },
    changeUserPasswordHandler,
  );

  app.patch(
    "/:id/role",
    { preHandler: requirePermission(PERMISSIONS.USER_CHANGE_ROLE) },
    changeUserRoleHandler,
  );

  const canArchive = requirePermission(PERMISSIONS.USER_ARCHIVE);
  app.patch("/:id/archive", { preHandler: canArchive }, archiveUserHandler);
  app.patch("/:id/restore", { preHandler: canArchive }, restoreUserHandler);
};
