import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "@/app/middleware/authenticate";
import { authorizeRoles } from "@/app/middleware/authorize";
import {
  archiveProductSuggestionHandler,
  createProductSuggestionHandler,
  getActiveProductSuggestionsHandler,
  getProductSuggestionByIdHandler,
  getProductSuggestionsHandler,
  reorderProductSuggestionsHandler,
  restoreProductSuggestionHandler,
  updateProductSuggestionHandler,
} from "./product-suggestion.controller";

export const productSuggestionRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  app.get("/active", getActiveProductSuggestionsHandler);
  app.get("/", getProductSuggestionsHandler);
  app.post("/", { preHandler: authorizeRoles("owner", "manager") }, createProductSuggestionHandler);

  app.patch("/reorder", { preHandler: authorizeRoles("owner", "manager") }, reorderProductSuggestionsHandler);
  app.get("/:id", getProductSuggestionByIdHandler);
  app.patch("/:id", { preHandler: authorizeRoles("owner", "manager") }, updateProductSuggestionHandler);
  app.patch("/:id/archive", { preHandler: authorizeRoles("owner", "manager") }, archiveProductSuggestionHandler);
  app.patch("/:id/restore", { preHandler: authorizeRoles("owner", "manager") }, restoreProductSuggestionHandler);
};
