import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "@/app/middleware/authenticate";
import { authorizeRoles } from "@/app/middleware/authorize";
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

  app.get("/assigned", getAssignedCardsHandler);
  app.get("/available", getAvailableCardsHandler);
  app.get("/numbering", getCardNumberingHandler);
  app.get("/", getCardsHandler);

  app.post("/", { preHandler: authorizeRoles("owner", "manager") }, createCardHandler);

  app.get("/:id", getCardByIdHandler);
  app.patch("/:id", { preHandler: authorizeRoles("owner", "manager") }, updateCardHandler);
  app.get("/:cardId/assignment", getCardAssignmentByCardIdHandler);
  app.get("/:id/history", getCardHistoryHandler);
  app.post("/:id/assign", { preHandler: authorizeRoles("owner", "manager") }, assignCardHandler);
  app.patch("/:id/make-available", { preHandler: authorizeRoles("owner", "manager") }, makeCardAvailableHandler);
};
