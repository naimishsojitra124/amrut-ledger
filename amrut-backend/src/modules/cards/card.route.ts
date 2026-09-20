import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "@/app/middleware/authenticate";
import { requirePermission } from "@/app/middleware/authorize";
import { PERMISSIONS } from "@/app/auth/permissions";
import {
  assignCardHandler,
  createCardHandler,
  getAssignedCardsHandler,
  getAvailableCardsHandler,
  getCardAssignmentByCardIdHandler,
  getCardByIdHandler,
  getCardHistoryHandler,
  getCardNumberingHandler,
  getCardsHandler,
  makeCardAvailableHandler,
  updateCardHandler,
} from "./card.controller";

export const cardRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  const canView = requirePermission(PERMISSIONS.CARD_VIEW);
  const canManage = requirePermission(PERMISSIONS.CARD_MANAGE);
  const canAssign = requirePermission(PERMISSIONS.CARD_ASSIGN);

  app.get("/assigned", { preHandler: canView }, getAssignedCardsHandler);
  app.get("/available", { preHandler: canView }, getAvailableCardsHandler);
  app.get("/numbering", { preHandler: canView }, getCardNumberingHandler);
  app.get("/", { preHandler: canView }, getCardsHandler);

  app.post("/", { preHandler: canManage }, createCardHandler);

  app.get("/:id", { preHandler: canView }, getCardByIdHandler);
  app.patch("/:id", { preHandler: canManage }, updateCardHandler);
  app.get("/:cardId/assignment", { preHandler: canView }, getCardAssignmentByCardIdHandler);
  app.get("/:id/history", { preHandler: canView }, getCardHistoryHandler);
  app.post("/:id/assign", { preHandler: canAssign }, assignCardHandler);
  app.patch("/:id/make-available", { preHandler: canAssign }, makeCardAvailableHandler);
};
