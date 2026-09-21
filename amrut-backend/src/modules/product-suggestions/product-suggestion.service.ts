import type { FastifyInstance } from "fastify";
import type { Prisma, PrismaClient } from "../../../generated/prisma/client";
import { TX_OPTIONS } from "@/app/db/transaction";
import type {
  CreateProductSuggestionRequest,
  ProductSuggestionActiveResponse,
  ProductSuggestionListQuery,
  ProductSuggestionListResponse,
  ProductSuggestionReorderResponse,
  ProductSuggestionResponse,
  UpdateProductSuggestionRequest,
} from "./product-suggestion.types";
import { searchTerm } from "@/app/db/search";

interface ProductSuggestionRecord {
  id: string;
  name: string;
  displayOrder: number;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

interface ProductSuggestionSearchWhere {
  name: {
    contains: string;
    mode: "insensitive";
  };
}

interface ReorderItem {
  id: string;
  displayOrder: number;
  createdAt: Date;
}

interface ProductSuggestionError extends Error {
  statusCode: number;
}

type TransactionClient = Prisma.TransactionClient;

function createHttpError(statusCode: number, message: string): ProductSuggestionError {
  const error = new Error(message) as ProductSuggestionError;
  error.statusCode = statusCode;
  return error;
}

function getPrisma(app: FastifyInstance): PrismaClient {
  return (app as FastifyInstance & { prisma: PrismaClient }).prisma;
}

function normalizeProductSuggestion(
  productSuggestion: ProductSuggestionRecord,
): ProductSuggestionResponse {
  return {
    id: productSuggestion.id,
    name: productSuggestion.name,
    displayOrder: productSuggestion.displayOrder,
    status: productSuggestion.status,
    createdAt: productSuggestion.createdAt,
    updatedAt: productSuggestion.updatedAt,
  };
}

function buildSearchWhere(search?: string): ProductSuggestionSearchWhere | undefined {
  if (!search) return undefined;

  return {
    name: {
      contains: search,
      mode: "insensitive" as const,
    },
  };
}

async function getNextDisplayOrder(prisma: PrismaClient): Promise<number> {
  const lastItem = await prisma.productSuggestion.findFirst({
    orderBy: [{ displayOrder: "desc" }, { createdAt: "desc" }],
    select: {
      displayOrder: true,
    },
  });

  return (lastItem?.displayOrder ?? -1) + 1;
}

async function shiftOrdersUp(
  tx: TransactionClient,
  startingFrom: number,
): Promise<void> {
  await tx.productSuggestion.updateMany({
    where: {
      displayOrder: {
        gte: startingFrom,
      },
    },
    data: {
      displayOrder: {
        increment: 1,
      },
    },
  });
}

async function shiftOrdersDown(
  tx: TransactionClient,
  fromExclusive: number,
  toInclusive: number,
): Promise<void> {
  await tx.productSuggestion.updateMany({
    where: {
      displayOrder: {
        gt: fromExclusive,
        lte: toInclusive,
      },
    },
    data: {
      displayOrder: {
        decrement: 1,
      },
    },
  });
}

export async function createProductSuggestion(
  app: FastifyInstance,
  input: CreateProductSuggestionRequest,
): Promise<ProductSuggestionResponse> {
  const prisma = getPrisma(app);

  const desiredOrder = input.displayOrder ?? (await getNextDisplayOrder(prisma));

  const productSuggestion = await prisma.$transaction(async (tx) => {
    await shiftOrdersUp(tx, desiredOrder);

    return tx.productSuggestion.create({
      data: {
        name: input.name.trim(),
        displayOrder: desiredOrder,
        status: "active",
      },
    });
  }, TX_OPTIONS);

  return normalizeProductSuggestion(productSuggestion);
}

export async function getProductSuggestions(
  app: FastifyInstance,
  query: ProductSuggestionListQuery,
): Promise<ProductSuggestionListResponse> {
  const prisma = getPrisma(app);

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;
  const where = buildSearchWhere(searchTerm(query.search)) ?? {};

  const [totalItems, items] = await Promise.all([
    prisma.productSuggestion.count({ where }),
    prisma.productSuggestion.findMany({
      where,
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      skip,
      take: limit,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  return {
    items: items.map(normalizeProductSuggestion),
    pageInfo: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

export async function getActiveProductSuggestions(
  app: FastifyInstance,
): Promise<ProductSuggestionActiveResponse> {
  const prisma = getPrisma(app);

  const items = await prisma.productSuggestion.findMany({
    where: { status: "active" },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });

  return {
    items: items.map(normalizeProductSuggestion),
  };
}

export async function getProductSuggestionById(
  app: FastifyInstance,
  id: string,
): Promise<ProductSuggestionResponse> {
  const prisma = getPrisma(app);

  const productSuggestion = await prisma.productSuggestion.findUnique({
    where: { id },
  });

  if (!productSuggestion) {
    throw createHttpError(404, "Product suggestion not found");
  }

  return normalizeProductSuggestion(productSuggestion);
}

export async function updateProductSuggestion(
  app: FastifyInstance,
  id: string,
  input: UpdateProductSuggestionRequest,
): Promise<ProductSuggestionResponse> {
  const prisma = getPrisma(app);

  const existing = await prisma.productSuggestion.findUnique({
    where: { id },
  });

  if (!existing) {
    throw createHttpError(404, "Product suggestion not found");
  }

  const hasOrderChange =
    input.displayOrder !== undefined && input.displayOrder !== existing.displayOrder;

  const updatedProductSuggestion = await prisma.$transaction(async (tx) => {
    if (hasOrderChange) {
      const targetOrder = input.displayOrder!;

      if (targetOrder < existing.displayOrder) {
        // Moving up: shift everything between targetOrder and current order down the list by +1
        await shiftOrdersUp(tx, targetOrder);
        await tx.productSuggestion.update({
          where: { id },
          data: {
            displayOrder: targetOrder,
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          },
        });
      } else {
        // Moving down: shift everything between current order and target order up the list by -1
        await shiftOrdersDown(tx, existing.displayOrder, targetOrder);
        await tx.productSuggestion.update({
          where: { id },
          data: {
            displayOrder: targetOrder,
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          },
        });
      }
    } else {
      await tx.productSuggestion.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        },
      });
    }

    return tx.productSuggestion.findUnique({
      where: { id },
    });
  }, TX_OPTIONS);

  if (!updatedProductSuggestion) {
    throw createHttpError(500, "Failed to update product suggestion");
  }

  return normalizeProductSuggestion(updatedProductSuggestion);
}

export async function archiveProductSuggestion(
  app: FastifyInstance,
  id: string,
): Promise<ProductSuggestionResponse> {
  const prisma = getPrisma(app);

  const existing = await prisma.productSuggestion.findUnique({
    where: { id },
  });

  if (!existing) {
    throw createHttpError(404, "Product suggestion not found");
  }

  const productSuggestion = await prisma.productSuggestion.update({
    where: { id },
    data: {
      status: "inactive",
    },
  });

  return normalizeProductSuggestion(productSuggestion);
}

export async function restoreProductSuggestion(
  app: FastifyInstance,
  id: string,
): Promise<ProductSuggestionResponse> {
  const prisma = getPrisma(app);

  const existing = await prisma.productSuggestion.findUnique({
    where: { id },
  });

  if (!existing) {
    throw createHttpError(404, "Product suggestion not found");
  }

  const productSuggestion = await prisma.productSuggestion.update({
    where: { id },
    data: {
      status: "active",
    },
  });

  return normalizeProductSuggestion(productSuggestion);
}

export async function reorderProductSuggestions(
  app: FastifyInstance,
  orderedIds: string[],
): Promise<ProductSuggestionReorderResponse> {
  const prisma = getPrisma(app);

  const allItems: ReorderItem[] = await prisma.productSuggestion.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });

  const allIds: Set<string> = new Set(allItems.map((item) => item.id));
  const providedIds: Set<string> = new Set(orderedIds);

  for (const id of orderedIds) {
    if (!allIds.has(id)) {
      throw createHttpError(404, `Product suggestion not found: ${id}`);
    }
  }

  const remainingItems: ReorderItem[] = allItems.filter(
    (item) => !providedIds.has(item.id),
  );

  const nextOrder: string[] = [
    ...orderedIds,
    ...remainingItems.map((item) => item.id),
  ];

  const updates = nextOrder.map((id: string, index: number) =>
    prisma.productSuggestion.update({
      where: { id },
      data: { displayOrder: index },
    }),
  );

  await prisma.$transaction(updates);

  const updated: ProductSuggestionRecord[] = await prisma.productSuggestion.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });

  return {
    items: updated.map(normalizeProductSuggestion),
  };
}
