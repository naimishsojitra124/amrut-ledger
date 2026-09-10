import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "@/app/middleware/authenticate";
import {
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  revokeSessionHandler,
  sessionsHandler,
} from "./auth.controller";

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/login", loginHandler);
  app.get("/me", { preHandler: authenticate }, meHandler);
  app.get("/sessions", { preHandler: authenticate }, sessionsHandler);
  app.delete("/sessions/:id", { preHandler: authenticate }, revokeSessionHandler);
  app.post("/refresh", refreshHandler);
  app.post("/logout", logoutHandler);
};
