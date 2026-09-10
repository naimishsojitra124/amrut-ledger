import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../../generated/prisma/client";
import type {
  AssignCardRequest,
  CardAssignmentSummaryResponse,
  CardHistoryResponse,
  CardListQuery,
  CardListResponse,
  CardNumberingResponse,
  CardResponse,
  CardSummaryResponse,
  CreateCardRequest,
  UpdateCardRequest,
} from "./card.types";

function createHttpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}

function getPrisma(app: FastifyInstance) {
  return (app as FastifyInstance & { prisma: PrismaClient }).prisma;
}

export function normalizeAssignment(assignment: any): CardAssignmentSummaryResponse {
  return {
    id: assignment.id,
    cardId: assignment.cardId,
    customerId: assignment.customerId,
    assignedAt: assignment.assignedAt.toISOString(),
    unassignedAt: assignment.unassignedAt ? assignment.unassignedAt.toISOString() : null,
    depositAtAssignment: assignment.depositAtAssignment ?? 0,
    assignedBy: {
      id: assignment.assignedBy.id,
      fullName: assignment.assignedBy.fullName,
    },
    customer: {
      id: assignment.customer.id,
      fullName: assignment.customer.fullName,
      mobileNumber: assignment.customer.mobileNumber,
    },
  };
}

function normalizeCard(card: any): CardResponse {
  const currentAssignment = card.assignments?.[0] ? normalizeAssignment(card.assignments[0]) : null;

  return {
    id: card.id,
    cardNumber: card.cardNumber,
    status: card.status,
    createdAt: card.createdAt.toISOString(),
    currentAssignment,
  };
}

function buildCardWhere(query: CardListQuery) {
  const where: any = {};

  if (query.status) {
    where.status = query.status;
  }

  return where;
}

function matchesSearch(card: CardResponse, search: string) {
  const haystacks = [
    String(card.cardNumber),
    card.currentAssignment?.customer.fullName ?? "",
    card.currentAssignment?.customer.mobileNumber ?? "",
    card.currentAssignment?.assignedBy.fullName ?? "",
  ];

  return haystacks.some((value) => value.toLowerCase().includes(search.toLowerCase()));
}

async function loadCards(app: FastifyInstance, query: CardListQuery) {
  const prisma = getPrisma(app);

  const cards = await prisma.card.findMany({
    where: buildCardWhere(query),
    orderBy: [{ cardNumber: "asc" }],
    include: {
      assignments: {
        where: { unassignedAt: null },
        orderBy: { assignedAt: "desc" },
        take: 1,
        include: {
          customer: true,
          assignedBy: true,
        },
      },
    },
  });

  let normalized = cards.map(normalizeCard);

  if (query.search) {
    normalized = normalized.filter((card: CardResponse) =>
      matchesSearch(card, query.search!.trim()),
    );
  }

  return normalized;
}

function buildSummary(items: CardResponse[]): CardSummaryResponse {
  return {
    totalCards: items.length,
    assignedCards: items.filter((card) => card.status === "assigned").length,
    availableCards: items.filter((card) => card.status === "available").length,
  };
}

export async function getCards(
  app: FastifyInstance,
  query: CardListQuery,
): Promise<CardListResponse> {
  const items = await loadCards(app, query);

  return {
    items,
    summary: buildSummary(items),
  };
}

export async function getAssignedCards(app: FastifyInstance): Promise<CardListResponse> {
  const items = await loadCards(app, { status: "assigned" });

  return {
    items,
    summary: buildSummary(items),
  };
}

export async function getAvailableCards(app: FastifyInstance): Promise<CardListResponse> {
  const items = await loadCards(app, { status: "available" });

  return {
    items,
    summary: buildSummary(items),
  };
}

export async function getCardById(app: FastifyInstance, id: string): Promise<CardResponse> {
  const prisma = getPrisma(app);

  const card = await prisma.card.findUnique({
    where: { id },
    include: {
      assignments: {
        where: { unassignedAt: null },
        orderBy: { assignedAt: "desc" },
        take: 1,
        include: {
          customer: true,
          assignedBy: true,
        },
      },
    },
  });

  if (!card) {
    throw createHttpError(404, "Card not found");
  }

  return normalizeCard(card);
}


export async function getCardNumbering(app: FastifyInstance): Promise<CardNumberingResponse> {
  const prisma = getPrisma(app);

  const result = await prisma.card.aggregate({
    _max: {
      cardNumber: true,
    },
  });

  const lastCardNumber = result._max.cardNumber ?? null;

  return {
    lastCardNumber,
    nextCardNumber: lastCardNumber !== null ? lastCardNumber + 1 : 1,
  };
}

export async function createCard(
  app: FastifyInstance,
  input: CreateCardRequest,
): Promise<CardResponse> {
  const prisma = getPrisma(app);

  const existing = await prisma.card.findUnique({
    where: { cardNumber: input.cardNumber },
  });

  if (existing) {
    throw createHttpError(409, "Card number already exists");
  }

  const card = await prisma.card.create({
    data: {
      cardNumber: input.cardNumber,
      status: "available",
    },
    include: {
      assignments: true,
    },
  });

  return normalizeCard({
    ...card,
    assignments: [],
  });
}

export async function updateCard(
  app: FastifyInstance,
  id: string,
  input: UpdateCardRequest,
): Promise<CardResponse> {
  const prisma = getPrisma(app);

  const card = await prisma.card.findUnique({
    where: { id },
  });

  if (!card) {
    throw createHttpError(404, "Card not found");
  }

  const activeAssignment = await prisma.cardAssignment.findFirst({
    where: {
      cardId: id,
      unassignedAt: null,
    },
  });

  if (activeAssignment || card.status === "assigned") {
    throw createHttpError(409, "Assigned cards cannot be updated");
  }

  if (input.cardNumber !== undefined) {
    const duplicate = await prisma.card.findUnique({
      where: { cardNumber: input.cardNumber },
    });

    if (duplicate && duplicate.id !== id) {
      throw createHttpError(409, "Card number already exists");
    }
  }

  const updated = await prisma.card.update({
    where: { id },
    data: {
      ...(input.cardNumber !== undefined ? { cardNumber: input.cardNumber } : {}),
    },
    include: {
      assignments: {
        where: { unassignedAt: null },
        orderBy: { assignedAt: "desc" },
        take: 1,
        include: {
          customer: true,
          assignedBy: true,
        },
      },
    },
  });

  return normalizeCard(updated);
}

export async function getCardAssignmentByCardId(
  app: FastifyInstance,
  cardId: string,
): Promise<CardAssignmentSummaryResponse> {
  const prisma = getPrisma(app);

  const assignment = await prisma.cardAssignment.findFirst({
    where: {
      cardId,
      unassignedAt: null,
    },
    include: {
      customer: true,
      assignedBy: true,
    },
    orderBy: {
      assignedAt: "desc",
    },
  });

  if (!assignment) {
    throw createHttpError(404, "Active card assignment not found");
  }

  return normalizeAssignment(assignment);
}

export async function getCardHistory(
  app: FastifyInstance,
  cardId: string,
): Promise<CardHistoryResponse> {
  const prisma = getPrisma(app);

  const items = await prisma.cardAssignment.findMany({
    where: { cardId },
    orderBy: { assignedAt: "desc" },
    include: {
      customer: true,
      assignedBy: true,
    },
  });

  return {
    items: items.map(normalizeAssignment),
  };
}

export async function assignCardToCustomer(
  app: FastifyInstance,
  cardId: string,
  input: AssignCardRequest,
  assignedById: string,
): Promise<CardAssignmentSummaryResponse> {
  const prisma = getPrisma(app);

  const [card, customer] = await Promise.all([
    prisma.card.findUnique({ where: { id: cardId } }),
    prisma.customer.findUnique({ where: { id: input.customerId } }),
  ]);

  if (!card) {
    throw createHttpError(404, "Card not found");
  }

  if (!customer) {
    throw createHttpError(404, "Customer not found");
  }

  const activeAssignmentForCard = await prisma.cardAssignment.findFirst({
    where: {
      cardId,
      unassignedAt: null,
    },
  });

  const activeAssignmentForCustomer = await prisma.cardAssignment.findFirst({
    where: {
      customerId: input.customerId,
      unassignedAt: null,
    },
  });

  if (activeAssignmentForCard && activeAssignmentForCard.customerId !== input.customerId) {
    throw createHttpError(409, "Card is already assigned to another customer");
  }

  if (activeAssignmentForCustomer && activeAssignmentForCustomer.cardId === cardId) {
    const existing = await prisma.cardAssignment.findUnique({
      where: { id: activeAssignmentForCustomer.id },
      include: {
        customer: true,
        assignedBy: true,
      },
    });

    if (!existing) {
      throw createHttpError(404, "Card assignment not found");
    }

    return normalizeAssignment(existing);
  }

  const assignedAt = input.assignedAt ?? new Date();
  const depositAtAssignment = input.depositAtAssignment ?? 0;

  const result = await prisma.$transaction(async (tx: PrismaClient) => {
    if (activeAssignmentForCustomer) {
      await tx.cardAssignment.update({
        where: { id: activeAssignmentForCustomer.id },
        data: {
          unassignedAt: assignedAt,
        },
      });

      await tx.card.update({
        where: { id: activeAssignmentForCustomer.cardId },
        data: {
          status: "available",
        },
      });
    }

    await tx.card.update({
      where: { id: cardId },
      data: {
        status: "assigned",
      },
    });

    return tx.cardAssignment.create({
      data: {
        cardId,
        customerId: input.customerId,
        assignedAt,
        unassignedAt: null,
        depositAtAssignment,
        assignedById,
      },
      include: {
        customer: true,
        assignedBy: true,
      },
    });
  });

  return normalizeAssignment(result);
}

export async function makeCardAvailable(
  app: FastifyInstance,
  cardId: string,
): Promise<CardAssignmentSummaryResponse> {
  const prisma = getPrisma(app);

  const activeAssignment = await prisma.cardAssignment.findFirst({
    where: {
      cardId,
      unassignedAt: null,
    },
    include: {
      customer: true,
      assignedBy: true,
    },
    orderBy: {
      assignedAt: "desc",
    },
  });

  if (!activeAssignment) {
    throw createHttpError(404, "Active card assignment not found");
  }

  const now = new Date();

  const updated = await prisma.$transaction(async (tx: PrismaClient) => {
    await tx.cardAssignment.update({
      where: { id: activeAssignment.id },
      data: {
        unassignedAt: now,
      },
    });

    await tx.card.update({
      where: { id: cardId },
      data: {
        status: "available",
      },
    });

    return tx.cardAssignment.findUnique({
      where: { id: activeAssignment.id },
      include: {
        customer: true,
        assignedBy: true,
      },
    });
  });

  if (!updated) {
    throw createHttpError(404, "Card assignment not found");
  }

  return normalizeAssignment(updated);
}
