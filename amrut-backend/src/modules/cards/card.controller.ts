import type { FastifyReply, FastifyRequest } from "fastify";
import {
  assignCardSchema,
  cardAssignmentParamSchema,
  cardIdParamSchema,
  cardListQuerySchema,
  createCardSchema,
  updateCardSchema,
} from "./card.schema";
import {
  assignCardToCustomer,
  createCard,
  getAssignedCards,
  getAvailableCards,
  getCardAssignmentByCardId,
  getCardById,
  getCardHistory,
  getCardNumbering,
  getCards,
  makeCardAvailable,
  updateCard,
} from "./card.service";

function getCurrentUserId(request: FastifyRequest) {
  const user = request.user as { sub?: string };
  if (!user?.sub) {
    throw new Error("Unauthorized");
  }
  return user.sub;
}

export async function getCardsHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = cardListQuerySchema.parse(request.query);
  const result = await getCards(request.server, query);

  return reply.send(result);
}

export async function getAssignedCardsHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await getAssignedCards(request.server);

  return reply.send(result);
}

export async function getAvailableCardsHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await getAvailableCards(request.server);

  return reply.send(result);
}

export async function getCardByIdHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = cardIdParamSchema.parse(request.params);
  const result = await getCardById(request.server, params.id);

  return reply.send(result);
}

export async function getCardNumberingHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await getCardNumbering(request.server);

  return reply.send(result);
}

export async function createCardHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createCardSchema.parse(request.body);
  const result = await createCard(request.server, body);

  return reply.status(201).send(result);
}

export async function updateCardHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = cardIdParamSchema.parse(request.params);
  const body = updateCardSchema.parse(request.body);
  const result = await updateCard(request.server, params.id, body);

  return reply.send(result);
}

export async function getCardAssignmentByCardIdHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = cardAssignmentParamSchema.parse(request.params);
  const result = await getCardAssignmentByCardId(request.server, params.cardId);

  return reply.send(result);
}

export async function getCardHistoryHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = cardIdParamSchema.parse(request.params);
  const result = await getCardHistory(request.server, params.id);

  return reply.send(result);
}

export async function assignCardHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = cardIdParamSchema.parse(request.params);
  const body = assignCardSchema.parse(request.body);
  const assignedById = getCurrentUserId(request);

  const result = await assignCardToCustomer(request.server, params.id, body, assignedById);

  return reply.send(result);
}

export async function makeCardAvailableHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = cardIdParamSchema.parse(request.params);
  const result = await makeCardAvailable(request.server, params.id);

  return reply.send(result);
}
