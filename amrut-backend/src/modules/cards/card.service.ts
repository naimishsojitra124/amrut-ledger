import type { FastifyInstance } from "fastify";
import type { Prisma, PrismaClient } from "../../../generated/prisma/client";
import { AUDIT_FIELD, change } from "../audit/audit.util";
import { TX_OPTIONS } from "@/app/db/transaction";
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

/**
 * Hard ceiling so a card list can never become an unbounded response.
 *
 * The settings screen filters and pages this set in the browser, so the cap is
 * set well above any realistic card count rather than at a display page size.
 */
const CARD_PAGE_LIMIT = 500;

/**
 * Searching happens in the database.
 *
 * Card numbers are integers so they only match exactly; the text fields live
 * on the active assignment's customer, which Prisma can filter through the
 * relation. The previous version fetched every card with its assignment,
 * customer and assigning user, then filtered in JavaScript.
 */
function buildCardWhere(query: CardListQuery): Prisma.CardWhereInput {
  const where: Prisma.CardWhereInput = {};

  if (query.status) {
    where.status = query.status;
  }

  const search = query.search?.trim();

  if (search) {
    const matches: Prisma.CardWhereInput[] = [
      {
        assignments: {
          some: {
            unassignedAt: null,
            customer: { is: { fullName: { contains: search, mode: "insensitive" } } },
          },
        },
      },
      {
        assignments: {
          some: {
            unassignedAt: null,
            customer: { is: { mobileNumber: { contains: search } } },
          },
        },
      },
      {
        assignments: {
          some: {
            unassignedAt: null,
            assignedBy: { is: { fullName: { contains: search, mode: "insensitive" } } },
          },
        },
      },
    ];

    const cardNumber = Number(search);
    if (Number.isSafeInteger(cardNumber) && cardNumber > 0) {
      matches.push({ cardNumber });
    }

    where.OR = matches;
  }

  return where;
}

const CARD_LIST_INCLUDE = {
  assignments: {
    where: { unassignedAt: null },
    orderBy: { assignedAt: "desc" },
    take: 1,
    include: { customer: true, assignedBy: true },
  },
} satisfies Prisma.CardInclude;

/**
 * Counted in the database against the *unfiltered* card set so the header
 * totals stay stable while the user filters or searches. Deriving them from
 * the visible rows made "Available: 0" appear whenever the assigned filter
 * was active.
 */
async function loadCardSummary(prisma: PrismaClient): Promise<CardSummaryResponse> {
  const [totalCards, assignedCards, availableCards] = await Promise.all([
    prisma.card.count(),
    prisma.card.count({ where: { status: "assigned" } }),
    prisma.card.count({ where: { status: "available" } }),
  ]);

  return { totalCards, assignedCards, availableCards };
}

async function loadCards(
  app: FastifyInstance,
  query: CardListQuery,
): Promise<CardListResponse> {
  const prisma = getPrisma(app);
  const limit = Math.min(query.limit ?? CARD_PAGE_LIMIT, CARD_PAGE_LIMIT);
  const page = Math.max(1, query.page ?? 1);
  const where = buildCardWhere(query);

  const [matchedCards, cards, summary] = await Promise.all([
    prisma.card.count({ where }),
    prisma.card.findMany({
      where,
      orderBy: [{ cardNumber: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: CARD_LIST_INCLUDE,
    }),
    loadCardSummary(prisma),
  ]);

  const totalPages = Math.max(1, Math.ceil(matchedCards / limit));

  return {
    items: cards.map(normalizeCard),
    summary,
    pageInfo: {
      page,
      limit,
      totalItems: matchedCards,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

export async function getCards(
  app: FastifyInstance,
  query: CardListQuery,
): Promise<CardListResponse> {
  return loadCards(app, query);
}

export async function getAssignedCards(
  app: FastifyInstance,
  query: CardListQuery = {},
): Promise<CardListResponse> {
  return loadCards(app, { ...query, status: "assigned" });
}

export async function getAvailableCards(
  app: FastifyInstance,
  query: CardListQuery = {},
): Promise<CardListResponse> {
  return loadCards(app, { ...query, status: "available" });
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
    let previousCardNumber: number | null = null;

    if (activeAssignmentForCustomer) {
      const previousCard = await tx.card.findUnique({
        where: { id: activeAssignmentForCustomer.cardId },
        select: { cardNumber: true },
      });

      previousCardNumber = previousCard?.cardNumber ?? null;

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

      await tx.auditLog.create({
        data: {
          customerId: input.customerId,
          type: "card_unassigned",
          title: `Card ${previousCardNumber ?? ""} unassigned`.replace("Card  ", "Card "),
          details: [change(AUDIT_FIELD.cardNumber, previousCardNumber ?? "", "None")],
          performedById: assignedById,
          relatedEntityType: "cardAssignment",
          relatedEntityId: activeAssignmentForCustomer.id,
        },
      });
    }

    await tx.card.update({
      where: { id: cardId },
      data: {
        status: "assigned",
      },
    });

    const assignment = await tx.cardAssignment.create({
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

    await tx.auditLog.create({
      data: {
        customerId: input.customerId,
        type: "card_assigned",
        title: `Card ${card.cardNumber} assigned`,
        details: [change(AUDIT_FIELD.cardNumber, previousCardNumber ?? "None", card.cardNumber)],
        performedById: assignedById,
        relatedEntityType: "cardAssignment",
        relatedEntityId: assignment.id,
      },
    });

    return assignment;
  }, TX_OPTIONS);

  return normalizeAssignment(result);
}

export async function makeCardAvailable(
  app: FastifyInstance,
  cardId: string,
  performedById: string,
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
      card: true,
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

    await tx.auditLog.create({
      data: {
        customerId: activeAssignment.customerId,
        type: "card_unassigned",
        title: `Card ${activeAssignment.card.cardNumber} released`,
        details: [change(AUDIT_FIELD.cardNumber, activeAssignment.card.cardNumber, "None")],
        performedById,
        relatedEntityType: "cardAssignment",
        relatedEntityId: activeAssignment.id,
      },
    });

    return tx.cardAssignment.findUnique({
      where: { id: activeAssignment.id },
      include: {
        customer: true,
        assignedBy: true,
      },
    });
  }, TX_OPTIONS);

  if (!updated) {
    throw createHttpError(404, "Card assignment not found");
  }

  return normalizeAssignment(updated);
}
