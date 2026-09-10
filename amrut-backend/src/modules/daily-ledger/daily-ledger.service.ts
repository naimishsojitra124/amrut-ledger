import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../../generated/prisma/client";
import type {
  AddDailyLedgerEntryRequest,
  CreateDailyLedgerRequest,
  DailyLedgerEntryResponse,
  DailyLedgerListItemResponse,
  DailyLedgerListQuery,
  DailyLedgerListResponse,
  DailyLedgerResponse,
  DailyLedgerSummaryResponse,
  DailyLedgerUserSummaryResponse,
  UpdateDailyLedgerEntryRequest,
} from "./daily-ledger.types";

function createHttpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}

function getPrisma(app: FastifyInstance) {
  return (app as FastifyInstance & { prisma: PrismaClient }).prisma;
}

function toBusinessDateString(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function dateStringToBusinessDate(dateString: string) {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function getTodayBusinessDateString() {
  return toBusinessDateString(new Date());
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function normalizeCustomer(customer: any) {
  return {
    id: customer.id,
    fullName: customer.fullName,
    mobileNumber: customer.mobileNumber,
  };
}

function normalizeCardAssignment(cardAssignment: any) {
  return {
    id: cardAssignment.id,
    cardId: cardAssignment.cardId,
    cardNumber: cardAssignment.card?.cardNumber ?? null,
    assignedAt: cardAssignment.assignedAt.toISOString(),
    unassignedAt: toIso(cardAssignment.unassignedAt),
    depositAtAssignment: cardAssignment.depositAtAssignment ?? 0,
  };
}

function normalizeUser(user: any): DailyLedgerUserSummaryResponse {
  return {
    id: user.id,
    fullName: user.fullName,
    status: user.status,
  };
}

function calculateEntryTotals(entry: {
  milkEntries: Array<{ litres: number; rate: number }>;
  productEntries: Array<{ quantity: number; unitPrice: number }>;
}) {
  const milkAmount = entry.milkEntries.reduce((sum, item) => sum + item.litres * item.rate, 0);
  const productAmount = entry.productEntries.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );

  return {
    totalMilkAmount: milkAmount,
    totalProductAmount: productAmount,
    totalAmount: milkAmount + productAmount,
  };
}

async function loadUserSummaryMap(prisma: PrismaClient, userIds: string[]) {
  const ids = [...new Set(userIds.filter(Boolean))];

  if (ids.length === 0) {
    return new Map<string, DailyLedgerUserSummaryResponse>();
  }

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
  });

  return new Map(users.map((user) => [user.id, normalizeUser(user)]));
}

function fallbackUserSummary(id: string): DailyLedgerUserSummaryResponse {
  return {
    id,
    fullName: "Unknown user",
    status: "inactive",
  };
}

async function normalizeEntry(
  prisma: PrismaClient,
  entry: any,
  entryIndex: number,
): Promise<DailyLedgerEntryResponse> {
  const createdByMap = await loadUserSummaryMap(prisma, [entry.createdById]);

  return {
    entryIndex,
    createdAt: entry.createdAt.toISOString(),
    createdBy: createdByMap.get(entry.createdById) ?? fallbackUserSummary(entry.createdById),
    notes: entry.notes ?? "",
    milkEntries: (entry.milkEntries ?? []).map((item: any) => ({
      milkTypeId: item.milkTypeId,
      milkTypeName: item.milkTypeName,
      rate: item.rate,
      litres: item.litres,
      amount: item.amount,
    })),
    productEntries: (entry.productEntries ?? []).map((item: any) => ({
      productSuggestionId: item.productSuggestionId ?? null,
      itemName: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
    })),
    totalAmount: entry.totalAmount ?? 0,
  };
}

async function normalizeLedger(prisma: PrismaClient, ledger: any): Promise<DailyLedgerResponse> {
  const entriesSource = ledger.entries ?? [];
  const entries = await Promise.all(
    entriesSource.map((entry: any, index: number) => normalizeEntry(prisma, entry, index)),
  );

  const totals = entries.reduce(
    (acc, entry) => {
      acc.totalMilkLitres += entry.milkEntries.reduce(
        (sum: number, item: { litres: number }) => sum + item.litres,
        0,
      );
      acc.totalMilkAmount += entry.milkEntries.reduce(
        (sum: number, item: { amount: number }) => sum + item.amount,
        0,
      );
      acc.totalProductAmount += entry.productEntries.reduce(
        (sum: number, item: { amount: number }) => sum + item.amount,
        0,
      );
      acc.grandTotal += entry.totalAmount;
      return acc;
    },
    {
      totalMilkLitres: 0,
      totalMilkAmount: 0,
      totalProductAmount: 0,
      grandTotal: 0,
    },
  );

  return {
    id: ledger.id,
    customerId: ledger.customerId,
    customer: normalizeCustomer(ledger.customer),
    cardAssignmentId: ledger.cardAssignmentId,
    cardAssignment: normalizeCardAssignment(ledger.cardAssignment),
    ledgerDate: toBusinessDateString(ledger.ledgerDate),
    entries,
    totalMilkLitres: totals.totalMilkLitres,
    totalMilkAmount: totals.totalMilkAmount,
    totalProductAmount: totals.totalProductAmount,
    grandTotal: totals.grandTotal,
    createdAt: ledger.createdAt.toISOString(),
    updatedAt: ledger.updatedAt.toISOString(),
    updatedBy: normalizeUser(ledger.updatedBy),
  };
}

async function normalizeLedgerListItem(
  prisma: PrismaClient,
  ledger: any,
): Promise<DailyLedgerListItemResponse> {
  const normalized = await normalizeLedger(prisma, ledger);

  return {
    id: normalized.id,
    customerId: normalized.customerId,
    customer: normalized.customer,
    cardAssignmentId: normalized.cardAssignmentId,
    cardAssignment: normalized.cardAssignment,
    ledgerDate: normalized.ledgerDate,
    entryCount: normalized.entries.length,
    totalMilkLitres: normalized.totalMilkLitres,
    totalMilkAmount: normalized.totalMilkAmount,
    totalProductAmount: normalized.totalProductAmount,
    grandTotal: normalized.grandTotal,
    updatedAt: normalized.updatedAt,
  };
}

async function getCustomerOrThrow(prisma: PrismaClient, customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    throw createHttpError(404, "Customer not found");
  }

  return customer;
}

async function getActiveAssignmentOrThrow(prisma: PrismaClient, customerId: string) {
  const assignment = await prisma.cardAssignment.findFirst({
    where: {
      customerId,
      unassignedAt: null,
    },
    include: {
      card: true,
    },
    orderBy: {
      assignedAt: "desc",
    },
  });

  if (!assignment) {
    throw createHttpError(409, "Active card assignment not found");
  }

  return assignment;
}

async function getAssignmentForLedgerDateOrThrow(
  prisma: PrismaClient,
  customerId: string,
  dateString: string,
) {
  const ledgerDate = dateStringToBusinessDate(dateString);
  const nextDay = new Date(ledgerDate.getTime() + 24 * 60 * 60 * 1000);

  const assignment = await prisma.cardAssignment.findFirst({
    where: {
      customerId,
      assignedAt: {
        lte: nextDay,
      },
      OR: [{ unassignedAt: null }, { unassignedAt: { gt: ledgerDate } }],
    },
    include: {
      card: true,
    },
    orderBy: {
      assignedAt: "desc",
    },
  });

  if (!assignment) {
    throw createHttpError(409, "Card assignment not found for the selected date");
  }

  return assignment;
}

async function getLedgerOrThrow(prisma: PrismaClient, customerId: string, dateString: string) {
  const ledgerDate = dateStringToBusinessDate(dateString);

  const ledger = await prisma.dailyLedger.findUnique({
    where: {
      customerId_ledgerDate: {
        customerId,
        ledgerDate,
      },
    },
    include: {
      customer: true,
      cardAssignment: {
        include: {
          card: true,
        },
      },
      updatedBy: true,
    },
  });

  if (!ledger) {
    throw createHttpError(404, "Daily ledger not found");
  }

  return ledger;
}

async function resolveMilkEntries(
  prisma: PrismaClient,
  entries: AddDailyLedgerEntryRequest["milkEntries"],
) {
  if (!entries || entries.length === 0) {
    return [];
  }

  const resolved = await Promise.all(
    entries.map(async (entry) => {
      const milkType = await prisma.milkType.findUnique({
        where: { id: entry.milkTypeId },
      });

      if (!milkType) {
        throw createHttpError(404, `Milk type not found: ${entry.milkTypeId}`);
      }

      if (milkType.status !== "active") {
        throw createHttpError(409, `Milk type is inactive: ${milkType.name}`);
      }

      const amount = entry.litres * milkType.rate;

      return {
        milkTypeId: milkType.id,
        milkTypeName: milkType.name,
        rate: milkType.rate,
        litres: entry.litres,
        amount,
      };
    }),
  );

  return resolved;
}

async function resolveProductEntries(
  prisma: PrismaClient,
  entries: AddDailyLedgerEntryRequest["productEntries"] = [],
) {
  if (!entries || entries.length === 0) {
    return [];
  }

  const resolved = await Promise.all(
    entries.map(async (entry) => {
      if (entry.productSuggestionId) {
        const productSuggestion = await prisma.productSuggestion.findUnique({
          where: { id: entry.productSuggestionId },
        });

        if (!productSuggestion) {
          throw createHttpError(404, `Product suggestion not found: ${entry.productSuggestionId}`);
        }

        if (productSuggestion.status !== "active") {
          throw createHttpError(409, `Product suggestion is inactive: ${productSuggestion.name}`);
        }
      }

      const amount = entry.quantity * entry.unitPrice;

      return {
        productSuggestionId: entry.productSuggestionId ?? null,
        itemName: entry.itemName,
        quantity: entry.quantity,
        unitPrice: entry.unitPrice,
        amount,
      };
    }),
  );

  return resolved;
}

async function createAuditLog(
  prisma: PrismaClient,
  input: {
    customerId: string;
    performedById: string;
    type: "entry_added" | "entry_updated" | "entry_deleted";
    title: string;
    ledgerId: string;
    oldValue: string;
    newValue: string;
  },
) {
  await prisma.auditLog.create({
    data: {
      customerId: input.customerId,
      type: input.type,
      title: input.title,
      details: [
        {
          field: "entry",
          oldValue: input.oldValue,
          newValue: input.newValue,
        },
      ],
      performedById: input.performedById,
      relatedEntityType: "ledger",
      relatedEntityId: input.ledgerId,
    },
  });
}

async function loadCustomerLedgers(
  prisma: PrismaClient,
  customerId: string,
  query: DailyLedgerListQuery,
) {
  const ledgers = await prisma.dailyLedger.findMany({
    where: { customerId },
    orderBy: [{ ledgerDate: "desc" }],
    include: {
      customer: true,
      cardAssignment: {
        include: {
          card: true,
        },
      },
      updatedBy: true,
    },
  });

  const filtered = ledgers.filter((ledger) => {
    if (query.month === undefined || query.year === undefined) {
      return true;
    }

    const ledgerDate = new Date(ledger.ledgerDate);
    const ledgerMonth = ledgerDate.getUTCMonth() + 1;
    const ledgerYear = ledgerDate.getUTCFullYear();

    return ledgerMonth === query.month && ledgerYear === query.year;
  });

  return filtered;
}

function paginate<T>(items: T[], page: number, limit: number) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;

  return {
    paginatedItems: items.slice(start, start + limit),
    pageInfo: {
      page: safePage,
      limit,
      totalItems,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPreviousPage: safePage > 1,
    },
  };
}

function buildLedgerInclude() {
  return {
    customer: true,
    cardAssignment: {
      include: {
        card: true,
      },
    },
    updatedBy: true,
  } as const;
}

export async function createTodayLedger(
  app: FastifyInstance,
  customerId: string,
  performedById: string,
  input: CreateDailyLedgerRequest,
): Promise<DailyLedgerResponse> {
  const prisma = getPrisma(app);

  await getCustomerOrThrow(prisma, customerId);
  await getActiveAssignmentOrThrow(prisma, customerId);

  const ledgerDate = dateStringToBusinessDate(getTodayBusinessDateString());

  const existing = await prisma.dailyLedger.findUnique({
    where: {
      customerId_ledgerDate: {
        customerId,
        ledgerDate,
      },
    },
    include: buildLedgerInclude(),
  });

  if (existing) {
    return normalizeLedger(prisma, existing);
  }

  const ledger = await prisma.dailyLedger.create({
    data: {
      customerId,
      cardAssignmentId: (await getActiveAssignmentOrThrow(prisma, customerId)).id,
      ledgerDate,
      entries: [],
      updatedById: performedById,
    },
    include: buildLedgerInclude(),
  });

  return normalizeLedger(prisma, ledger);
}

export async function getTodayLedger(
  app: FastifyInstance,
  customerId: string,
): Promise<DailyLedgerResponse> {
  const prisma = getPrisma(app);
  await getCustomerOrThrow(prisma, customerId);

  const ledgerDate = dateStringToBusinessDate(getTodayBusinessDateString());

  const ledger = await prisma.dailyLedger.findUnique({
    where: {
      customerId_ledgerDate: {
        customerId,
        ledgerDate,
      },
    },
    include: buildLedgerInclude(),
  });

  if (!ledger) {
    throw createHttpError(404, "Today's ledger not found");
  }

  return normalizeLedger(prisma, ledger);
}

export async function getLedgerByDate(
  app: FastifyInstance,
  customerId: string,
  date: string,
): Promise<DailyLedgerResponse> {
  const prisma = getPrisma(app);
  await getCustomerOrThrow(prisma, customerId);

  const ledger = await getLedgerOrThrow(prisma, customerId, date);
  return normalizeLedger(prisma, ledger);
}

export async function getCustomerLedgers(
  app: FastifyInstance,
  customerId: string,
  query: DailyLedgerListQuery,
): Promise<DailyLedgerListResponse> {
  const prisma = getPrisma(app);
  await getCustomerOrThrow(prisma, customerId);

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const all = await loadCustomerLedgers(prisma, customerId, query);
  const items = await Promise.all(all.map((ledger) => normalizeLedgerListItem(prisma, ledger)));
  const { paginatedItems, pageInfo } = paginate(items, page, limit);

  return {
    items: paginatedItems,
    pageInfo,
  };
}

export async function getCustomerLedgerSummary(
  app: FastifyInstance,
  customerId: string,
  query: DailyLedgerListQuery,
): Promise<DailyLedgerSummaryResponse> {
  const prisma = getPrisma(app);
  await getCustomerOrThrow(prisma, customerId);

  const ledgers = await loadCustomerLedgers(prisma, customerId, query);

  return {
    totalLedgers: ledgers.length,
    totalEntries: ledgers.reduce((sum, ledger) => sum + (ledger.entries?.length ?? 0), 0),
    totalMilkLitres: ledgers.reduce((sum, ledger) => {
      const ledgerTotal = (ledger.entries ?? []).reduce((entrySum: number, entry: any) => {
        return (
          entrySum +
          (entry.milkEntries ?? []).reduce(
            (milkSum: number, milkEntry: any) => milkSum + (milkEntry.litres ?? 0),
            0,
          )
        );
      }, 0);

      return sum + ledgerTotal;
    }, 0),
    totalMilkAmount: ledgers.reduce((sum, ledger) => {
      const ledgerTotal = (ledger.entries ?? []).reduce((entrySum: number, entry: any) => {
        return (
          entrySum +
          (entry.milkEntries ?? []).reduce(
            (milkSum: number, milkEntry: any) => milkSum + (milkEntry.amount ?? 0),
            0,
          )
        );
      }, 0);

      return sum + ledgerTotal;
    }, 0),
    totalProductAmount: ledgers.reduce((sum, ledger) => {
      const ledgerTotal = (ledger.entries ?? []).reduce((entrySum: number, entry: any) => {
        return (
          entrySum +
          (entry.productEntries ?? []).reduce(
            (productSum: number, productEntry: any) => productSum + (productEntry.amount ?? 0),
            0,
          )
        );
      }, 0);

      return sum + ledgerTotal;
    }, 0),
    grandTotal: ledgers.reduce((sum, ledger) => {
      const ledgerTotal = (ledger.entries ?? []).reduce((entrySum: number, entry: any) => {
        return entrySum + (entry.totalAmount ?? 0);
      }, 0);

      return sum + ledgerTotal;
    }, 0),
  };
}

export async function addLedgerEntry(
  app: FastifyInstance,
  customerId: string,
  performedById: string,
  date: string,
  input: AddDailyLedgerEntryRequest,
): Promise<DailyLedgerResponse> {
  const prisma = getPrisma(app);

  await getCustomerOrThrow(prisma, customerId);
  const assignment = await getAssignmentForLedgerDateOrThrow(prisma, customerId, date);

  const ledgerDate = dateStringToBusinessDate(date);
  const milkEntries = await resolveMilkEntries(prisma, input.milkEntries);
  const productEntries = await resolveProductEntries(prisma, input.productEntries ?? []);
  const totals = calculateEntryTotals({ milkEntries, productEntries });

  const entry = {
    createdAt: new Date(),
    createdById: performedById,
    clientRequestId: input.clientRequestId ?? "",
    milkEntries,
    productEntries,
    notes: input.notes ?? "",
    totalAmount: totals.totalAmount,
  };

  const result = await prisma.$transaction(async (tx: PrismaClient) => {
    const existing = await tx.dailyLedger.findUnique({
      where: {
        customerId_ledgerDate: {
          customerId,
          ledgerDate,
        },
      },
      include: buildLedgerInclude(),
    });

    if (!existing) {
      const ledger = await tx.dailyLedger.create({
        data: {
          customerId,
          cardAssignmentId: assignment.id,
          ledgerDate,
          entries: [entry],
          updatedById: performedById,
        },
        include: buildLedgerInclude(),
      });
      return { ledger, added: true };
    }

    if (input.clientRequestId && existing.entries.some((existingEntry) => existingEntry.clientRequestId === input.clientRequestId)) {
      return { ledger: existing, added: false };
    }

    const ledger = await tx.dailyLedger.update({
      where: { id: existing.id },
      data: {
        entries: [...(existing.entries ?? []), entry],
        updatedById: performedById,
      },
      include: buildLedgerInclude(),
    });
    return { ledger, added: true };
  });

  if (result.added) await createAuditLog(prisma, { customerId, performedById, type: "entry_added", title: "Daily ledger entry added", ledgerId: result.ledger.id, oldValue: "-", newValue: JSON.stringify(entry) });

  return normalizeLedger(prisma, result.ledger);
}

export async function updateLedgerEntry(
  app: FastifyInstance,
  customerId: string,
  performedById: string,
  date: string,
  entryIndex: number,
  input: UpdateDailyLedgerEntryRequest,
): Promise<DailyLedgerResponse> {
  const prisma = getPrisma(app);
  await getCustomerOrThrow(prisma, customerId);

  const ledger = await getLedgerOrThrow(prisma, customerId, date);

  if (entryIndex < 0 || entryIndex >= (ledger.entries?.length ?? 0)) {
    throw createHttpError(404, "Ledger entry not found");
  }

  if (
    input.milkEntries === undefined &&
    input.productEntries === undefined &&
    input.notes === undefined
  ) {
    throw createHttpError(400, "At least one field is required");
  }

  const oldEntry = ledger.entries[entryIndex];

  if (!oldEntry) {
    throw createHttpError(404, "Ledger entry not found");
  }

  const nextMilkEntries =
    input.milkEntries !== undefined
      ? await resolveMilkEntries(prisma, input.milkEntries)
      : (oldEntry.milkEntries ?? []);

  const nextProductEntries =
    input.productEntries !== undefined
      ? await resolveProductEntries(prisma, input.productEntries)
      : (oldEntry.productEntries ?? []);

  if (nextMilkEntries.length === 0 && nextProductEntries.length === 0) {
    throw createHttpError(400, "At least one entry is required");
  }

  const totals = calculateEntryTotals({
    milkEntries: nextMilkEntries,
    productEntries: nextProductEntries,
  });

  const nextEntry = {
    createdAt: oldEntry?.createdAt ?? new Date(),
    createdById: oldEntry?.createdById ?? performedById,
    clientRequestId: oldEntry?.clientRequestId ?? "",
    milkEntries: nextMilkEntries,
    productEntries: nextProductEntries,
    notes: input.notes !== undefined ? input.notes : (oldEntry.notes ?? ""),
    totalAmount: totals.totalAmount,
  };

  const nextEntries = [...ledger.entries];
  nextEntries[entryIndex] = nextEntry;

  const updatedLedger = await prisma.dailyLedger.update({
    where: { id: ledger.id },
    data: {
      entries: nextEntries,
      updatedById: performedById,
    },
    include: buildLedgerInclude(),
  });

  await createAuditLog(prisma, {
    customerId,
    performedById,
    type: "entry_updated",
    title: "Daily ledger entry updated",
    ledgerId: updatedLedger.id,
    oldValue: JSON.stringify(oldEntry),
    newValue: JSON.stringify(nextEntry),
  });

  return normalizeLedger(prisma, updatedLedger);
}

export async function deleteLedgerEntry(
  app: FastifyInstance,
  customerId: string,
  performedById: string,
  date: string,
  entryIndex: number,
): Promise<DailyLedgerResponse> {
  const prisma = getPrisma(app);
  await getCustomerOrThrow(prisma, customerId);

  const ledger = await getLedgerOrThrow(prisma, customerId, date);

  if (entryIndex < 0 || entryIndex >= (ledger.entries?.length ?? 0)) {
    throw createHttpError(404, "Ledger entry not found");
  }

  const oldEntry = ledger.entries[entryIndex];
  const nextEntries = ledger.entries.filter((_: any, index: number) => index !== entryIndex);

  const updatedLedger = await prisma.dailyLedger.update({
    where: { id: ledger.id },
    data: {
      entries: nextEntries,
      updatedById: performedById,
    },
    include: buildLedgerInclude(),
  });

  await createAuditLog(prisma, {
    customerId,
    performedById,
    type: "entry_deleted",
    title: "Daily ledger entry deleted",
    ledgerId: updatedLedger.id,
    oldValue: JSON.stringify(oldEntry),
    newValue: "-",
  });

  return normalizeLedger(prisma, updatedLedger);
}
