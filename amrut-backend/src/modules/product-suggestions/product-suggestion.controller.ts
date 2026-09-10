import type { FastifyReply, FastifyRequest } from "fastify";
import {
  archiveProductSuggestion,
  createProductSuggestion,
  getActiveProductSuggestions,
  getProductSuggestionById,
  getProductSuggestions,
  reorderProductSuggestions,
  restoreProductSuggestion,
  updateProductSuggestion,
} from "./product-suggestion.service";
import {
  createProductSuggestionSchema,
  productSuggestionIdParamSchema,
  productSuggestionListQuerySchema,
  reorderProductSuggestionsSchema,
  updateProductSuggestionSchema,
} from "./product-suggestion.schema";

export async function createProductSuggestionHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = createProductSuggestionSchema.parse(request.body);
  const result = await createProductSuggestion(request.server, body);

  return reply.status(201).send(result);
}

export async function getProductSuggestionsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const query = productSuggestionListQuerySchema.parse(request.query);
  const result = await getProductSuggestions(request.server, query);

  return reply.send(result);
}

export async function getActiveProductSuggestionsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const result = await getActiveProductSuggestions(request.server);

  return reply.send(result);
}

export async function getProductSuggestionByIdHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = productSuggestionIdParamSchema.parse(request.params);
  const result = await getProductSuggestionById(request.server, params.id);

  return reply.send(result);
}

export async function updateProductSuggestionHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = productSuggestionIdParamSchema.parse(request.params);
  const body = updateProductSuggestionSchema.parse(request.body);
  const result = await updateProductSuggestion(
    request.server,
    params.id,
    body,
  );

  return reply.send(result);
}

export async function archiveProductSuggestionHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = productSuggestionIdParamSchema.parse(request.params);
  const result = await archiveProductSuggestion(request.server, params.id);

  return reply.send(result);
}

export async function restoreProductSuggestionHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = productSuggestionIdParamSchema.parse(request.params);
  const result = await restoreProductSuggestion(request.server, params.id);

  return reply.send(result);
}

export async function reorderProductSuggestionsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = reorderProductSuggestionsSchema.parse(request.body);
  const result = await reorderProductSuggestions(request.server, body.orderedIds);

  return reply.send(result);
}