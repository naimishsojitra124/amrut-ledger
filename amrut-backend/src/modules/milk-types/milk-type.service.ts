import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../../generated/prisma/client";
import type {
  CreateMilkTypeRequest,
  MilkTypeListQuery,
  MilkTypeListResponse,
  MilkTypeResponse,
  UpdateMilkTypeRequest,
} from "./milk-type.types";
import { searchTerm } from "@/app/db/search";
import { createHttpError } from "@/app/http-error";
import { getPrisma } from "@/app/db/prisma";

function normalizeMilkType(milkType: {
  id: string;
  name: string;
  shortCode: string;
  rate: number;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}): MilkTypeResponse {
  return {
    id: milkType.id,
    name: milkType.name,
    shortCode: milkType.shortCode,
    rate: milkType.rate,
    status: milkType.status,
    createdAt: milkType.createdAt,
    updatedAt: milkType.updatedAt,
  };
}

function normalizeText(value: string) {
  return value.trim();
}

function buildSearchWhere(search?: string) {
  if (!search) return undefined;

  return {
    OR: [
      {
        name: {
          contains: search,
          mode: "insensitive" as const,
        },
      },
      {
        shortCode: {
          contains: search,
          mode: "insensitive" as const,
        },
      },
    ],
  };
}

export async function createMilkType(
  app: FastifyInstance,
  input: CreateMilkTypeRequest,
): Promise<MilkTypeResponse> {
  const prisma = getPrisma(app);

  const name = normalizeText(input.name);
  const shortCode = normalizeText(input.shortCode);

  const existing = await prisma.milkType.findUnique({
    where: { shortCode },
  });

  if (existing) {
    throw createHttpError(409, "Milk type short code already exists");
  }

  const milkType = await prisma.milkType.create({
    data: {
      name,
      shortCode,
      rate: input.rate,
      status: "active",
    },
  });

  return normalizeMilkType(milkType);
}

export async function getMilkTypes(
  app: FastifyInstance,
  query: MilkTypeListQuery,
): Promise<MilkTypeListResponse> {
  const prisma = getPrisma(app);

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;
  const searchWhere = buildSearchWhere(searchTerm(query.search));

  const where = {
    ...(searchWhere ?? {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const [totalItems, items] = await Promise.all([
    prisma.milkType.count({ where }),
    prisma.milkType.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip,
      take: limit,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  return {
    items: items.map(normalizeMilkType),
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

export async function getActiveMilkTypes(app: FastifyInstance): Promise<{
  items: MilkTypeResponse[];
}> {
  const prisma = getPrisma(app);

  const items = await prisma.milkType.findMany({
    where: { status: "active" },
    orderBy: [{ createdAt: "desc" }],
  });

  return {
    items: items.map(normalizeMilkType),
  };
}

export async function getMilkTypeById(app: FastifyInstance, id: string): Promise<MilkTypeResponse> {
  const prisma = getPrisma(app);

  const milkType = await prisma.milkType.findUnique({
    where: { id },
  });

  if (!milkType) {
    throw createHttpError(404, "Milk type not found");
  }

  return normalizeMilkType(milkType);
}

export async function updateMilkType(
  app: FastifyInstance,
  id: string,
  input: UpdateMilkTypeRequest,
): Promise<MilkTypeResponse> {
  const prisma = getPrisma(app);

  const existing = await prisma.milkType.findUnique({
    where: { id },
  });

  if (!existing) {
    throw createHttpError(404, "Milk type not found");
  }

  if (input.shortCode !== undefined) {
    const nextShortCode = normalizeText(input.shortCode);

    if (nextShortCode !== existing.shortCode) {
      const duplicate = await prisma.milkType.findUnique({
        where: { shortCode: nextShortCode },
      });

      if (duplicate && duplicate.id !== id) {
        throw createHttpError(409, "Milk type short code already exists");
      }
    }
  }

  const milkType = await prisma.milkType.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: normalizeText(input.name) } : {}),
      ...(input.shortCode !== undefined ? { shortCode: normalizeText(input.shortCode) } : {}),
      ...(input.rate !== undefined ? { rate: input.rate } : {}),
    },
  });

  return normalizeMilkType(milkType);
}

export async function archiveMilkType(app: FastifyInstance, id: string): Promise<MilkTypeResponse> {
  const prisma = getPrisma(app);

  const existing = await prisma.milkType.findUnique({
    where: { id },
  });

  if (!existing) {
    throw createHttpError(404, "Milk type not found");
  }

  const milkType = await prisma.milkType.update({
    where: { id },
    data: {
      status: "inactive",
    },
  });

  return normalizeMilkType(milkType);
}

export async function restoreMilkType(app: FastifyInstance, id: string): Promise<MilkTypeResponse> {
  const prisma = getPrisma(app);

  const existing = await prisma.milkType.findUnique({
    where: { id },
  });

  if (!existing) {
    throw createHttpError(404, "Milk type not found");
  }

  const milkType = await prisma.milkType.update({
    where: { id },
    data: {
      status: "active",
    },
  });

  return normalizeMilkType(milkType);
}
