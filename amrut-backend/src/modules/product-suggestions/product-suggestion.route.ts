import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "@/app/middleware/authenticate";
import { requirePermission } from "@/app/middleware/authorize";
import { PERMISSIONS } from "@/app/auth/permissions";
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

  const canView = requirePermission(PERMISSIONS.PRODUCT_SUGGESTION_VIEW);
  const canManage = requirePermission(PERMISSIONS.PRODUCT_SUGGESTION_MANAGE);

  app.get("/active", { preHandler: canView }, getActiveProductSuggestionsHandler);
  app.get("/", { preHandler: canView }, getProductSuggestionsHandler);
  app.post("/", { preHandler: canManage }, createProductSuggestionHandler);

  app.patch("/reorder", { preHandler: canManage }, reorderProductSuggestionsHandler);
  app.get("/:id", { preHandler: canView }, getProductSuggestionByIdHandler);
  app.patch("/:id", { preHandler: canManage }, updateProductSuggestionHandler);
  app.patch("/:id/archive", { preHandler: canManage }, archiveProductSuggestionHandler);
  app.patch("/:id/restore", { preHandler: canManage }, restoreProductSuggestionHandler);
};
