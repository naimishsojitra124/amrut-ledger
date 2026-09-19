import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../../generated/prisma/client";
import { AUDIT_FIELD, change, describeLedgerEntry } from "../audit/audit.util";
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

const USER_SUMMARY_SELECT = {
  id: true,
  fullName: true,
  status: true,
} as const;

const CUSTOMER_SUMMARY_SELECT = {
  id: true,
  fullName: true,
  mobileNumber: true,
} as const;

const CARD_ASSIGNMENT_SELECT = {
  id: true,
  cardId: true,
  assignedAt: true,
  unassignedAt: true,
  depositAtAssignment: true,
  card: {
    select: {
      cardNumber: true,
    },
  },
} as const;

const LEDGER_SELECT = {
  id: true,
  customerId: true,
  cardAssignmentId: true,
  ledgerDate: true,
  entries: true,
  createdAt: true,
  updatedAt: true,
  customer: {
    select: CUSTOMER_SUMMARY_SELECT,
  },
  cardAssignment: {
    select: CARD_ASSIGNMENT_SELECT,
  },
  updatedBy: {
    select: USER_SUMMARY_SELECT,
  },
} as const;

function normalizeCustomer(customer: {
  id: string;
  fullName: string;
  mobileNumber: string;
}) {
  return {
    id: customer.id,
    fullName: customer.fullName,
    mobileNumber: customer.mobileNumber,
  };
}

function normalizeCardAssignment(cardAssignment: {
  id: string;
  cardId: string;
  assignedAt: Date;
  unassignedAt: Date | null;
  depositAtAssignment: number;
  card: {
    cardNumber: number;
  } | null;
}) {
  return {
    id: cardAssignment.id,
    cardId: cardAssignment.cardId,
    cardNumber: cardAssignment.card?.cardNumber ?? null,
    assignedAt: cardAssignment.assignedAt.toISOString(),
    unassignedAt: toIso(cardAssignment.unassignedAt),
    depositAtAssignment: cardAssignment.depositAtAssignment ?? 0,
  };
}

function normalizeUser(
  user: {
    id: string;
    fullName: string;
    status: string;
  },
): DailyLedgerUserSummaryResponse {
  return {
    id: user.id,
    fullName: user.fullName,
    status: user.status as DailyLedgerUserSummaryResponse["status"],
  };
}

function fallbackUserSummary(id: string): DailyLedgerUserSummaryResponse {
  return {
    id,
    fullName: "Unknown user",
    status: "inactive",
  };
}

/**
 * Amounts are whole rupees. Litres stay fractional (2.5 L is normal), so the
 * rounding happens exactly once, where litres turn into money.
 */
function calculateEntryTotals(entry: {
  milkEntries: Array<{ amount: number }>;
  productEntries: Array<{ amount: number }>;
}) {
  const milkAmount = entry.milkEntries.reduce((sum, item) => sum + item.amount, 0);

  const productAmount = entry.productEntries.reduce((sum, item) => sum + item.amount, 0);

  return {
    totalMilkAmount: milkAmount,
    totalProductAmount: productAmount,
    totalAmount: milkAmount + productAmount,
  };
}

/**
 * Entry normalization is now synchronous.
 *
 * Previously this function queried the database for the creator of
 * every entry. That created an N+1 query problem.
 *
 * createdBy is now resolved in the single ledger query through
 * updatedBy only where applicable, while entry creator data is
 * loaded separately only when it is actually required.
 */
function normalizeEntry(
  entry: any,
  entryIndex: number,
  createdBy?: DailyLedgerUserSummaryResponse,
): DailyLedgerEntryResponse {
  return {
    entryIndex,
    createdAt: entry.createdAt.toISOString(),
    createdBy:
      createdBy ??
      fallbackUserSummary(entry.createdById),
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

function calculateLedgerTotals(entries: any[]) {
  return entries.reduce(
    (acc, entry) => {
      for (const milkEntry of entry.milkEntries ?? []) {
        acc.totalMilkLitres += milkEntry.litres ?? 0;
        acc.totalMilkAmount += milkEntry.amount ?? 0;
      }

      for (const productEntry of entry.productEntries ?? []) {
        acc.totalProductAmount += productEntry.amount ?? 0;
      }

      acc.grandTotal += entry.totalAmount ?? 0;

      return acc;
    },
    {
      totalMilkLitres: 0,
      totalMilkAmount: 0,
      totalProductAmount: 0,
      grandTotal: 0,
    },
  );
}

function normalizeLedger(
  ledger: any,
  userSummaryMap?: Map<string, DailyLedgerUserSummaryResponse>,
): DailyLedgerResponse {
  const entriesSource = ledger.entries ?? [];

  const entries = entriesSource.map((entry: any, index: number) =>
    normalizeEntry(
      entry,
      index,
      userSummaryMap?.get(entry.createdById),
    ),
  );

  const totals = calculateLedgerTotals(entriesSource);

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

function normalizeLedgerListItem(
  ledger: any,
  userSummaryMap?: Map<string, DailyLedgerUserSummaryResponse>,
): DailyLedgerListItemResponse {
  const entries = ledger.entries ?? [];
  const totals = calculateLedgerTotals(entries);

  return {
    id: ledger.id,
    customerId: ledger.customerId,
    customer: normalizeCustomer(ledger.customer),
    cardAssignmentId: ledger.cardAssignmentId,
    cardAssignment: normalizeCardAssignment(ledger.cardAssignment),
    ledgerDate: toBusinessDateString(ledger.ledgerDate),
    entryCount: entries.length,
    totalMilkLitres: totals.totalMilkLitres,
    totalMilkAmount: totals.totalMilkAmount,
    totalProductAmount: totals.totalProductAmount,
    grandTotal: totals.grandTotal,
    updatedAt: ledger.updatedAt.toISOString(),
  };
}

async function loadUserSummaryMap(
  prisma: PrismaClient,
  userIds: string[],
) {
  const ids = [...new Set(userIds.filter(Boolean))];

  if (ids.length === 0) {
    return new Map<string, DailyLedgerUserSummaryResponse>();
  }

  const users = await prisma.user.findMany({
    where: {
      id: {
        in: ids,
      },
    },
    select: USER_SUMMARY_SELECT,
  });

  return new Map(
    users.map((user) => [
      user.id,
      normalizeUser(user),
    ]),
  );
}

async function getActiveAssignmentOrThrow(
  prisma: PrismaClient,
  customerId: string,
) {
  const assignment = await prisma.cardAssignment.findFirst({
    where: {
      customerId,
      unassignedAt: null,
    },
    select: CARD_ASSIGNMENT_SELECT,
    orderBy: {
      assignedAt: "desc",
    },
  });

  if (!assignment) {
    throw createHttpError(
      409,
      "Active card assignment not found",
    );
  }

  return assignment;
}

async function getAssignmentForLedgerDateOrThrow(
  prisma: PrismaClient,
  customerId: string,
  dateString: string,
) {
  const ledgerDate = dateStringToBusinessDate(dateString);
  const nextDay = new Date(
    ledgerDate.getTime() + 24 * 60 * 60 * 1000,
  );

  const assignment = await prisma.cardAssignment.findFirst({
    where: {
      customerId,
      assignedAt: {
        lte: nextDay,
      },
      OR: [
        {
          unassignedAt: null,
        },
        {
          unassignedAt: {
            gt: ledgerDate,
          },
        },
      ],
    },
    select: CARD_ASSIGNMENT_SELECT,
    orderBy: {
      assignedAt: "desc",
    },
  });

  if (!assignment) {
    throw createHttpError(
      409,
      "Card assignment not found for the selected date",
    );
  }

  return assignment;
}

async function getLedgerOrThrow(
  prisma: PrismaClient,
  customerId: string,
  dateString: string,
) {
  const ledgerDate = dateStringToBusinessDate(dateString);

  const ledger = await prisma.dailyLedger.findUnique({
    where: {
      customerId_ledgerDate: {
        customerId,
        ledgerDate,
      },
    },
    select: LEDGER_SELECT,
  });

  if (!ledger) {
    throw createHttpError(
      404,
      "Daily ledger not found",
    );
  }

  return ledger;
}

async function resolveMilkEntries(
  prisma: PrismaClient,
  entries: AddDailyLedgerEntryRequest["milkEntries"],
) {
  if (!entries?.length) {
    return [];
  }

  const milkTypeIds = [
    ...new Set(entries.map((entry) => entry.milkTypeId)),
  ];

  const milkTypes = await prisma.milkType.findMany({
    where: {
      id: {
        in: milkTypeIds,
      },
    },
    select: {
      id: true,
      name: true,
      rate: true,
      status: true,
    },
  });

  const milkTypeMap = new Map(
    milkTypes.map((milkType) => [
      milkType.id,
      milkType,
    ]),
  );

  return entries.map((entry) => {
    const milkType = milkTypeMap.get(entry.milkTypeId);

    if (!milkType) {
      throw createHttpError(
        404,
        `Milk type not found: ${entry.milkTypeId}`,
      );
    }

    if (milkType.status !== "active") {
      throw createHttpError(
        409,
        `Milk type is inactive: ${milkType.name}`,
      );
    }

    const amount = Math.round(entry.litres * milkType.rate);

    return {
      milkTypeId: milkType.id,
      milkTypeName: milkType.name,
      rate: milkType.rate,
      litres: entry.litres,
      amount,
    };
  });
}

async function resolveProductEntries(
  prisma: PrismaClient,
  entries: AddDailyLedgerEntryRequest["productEntries"] = [],
) {
  if (!entries.length) {
    return [];
  }

  const productSuggestionIds = [
    ...new Set(
      entries
        .map((entry) => entry.productSuggestionId)
        .filter(
          (id): id is string => Boolean(id),
        ),
    ),
  ];

  if (productSuggestionIds.length > 0) {
    const productSuggestions =
      await prisma.productSuggestion.findMany({
        where: {
          id: {
            in: productSuggestionIds,
          },
        },
        select: {
          id: true,
          name: true,
          status: true,
        },
      });

    const productSuggestionMap = new Map(
      productSuggestions.map((productSuggestion) => [
        productSuggestion.id,
        productSuggestion,
      ]),
    );

    for (const productSuggestionId of productSuggestionIds) {
      const productSuggestion =
        productSuggestionMap.get(productSuggestionId);

      if (!productSuggestion) {
        throw createHttpError(
          404,
          `Product suggestion not found: ${productSuggestionId}`,
        );
      }

      if (productSuggestion.status !== "active") {
        throw createHttpError(
          409,
          `Product suggestion is inactive: ${productSuggestion.name}`,
        );
      }
    }
  }

  return entries.map((entry) => ({
    productSuggestionId:
      entry.productSuggestionId ?? null,
    itemName: entry.itemName,
    quantity: entry.quantity,
    unitPrice: entry.unitPrice,
    amount: Math.round(entry.quantity * entry.unitPrice),
  }));
}

/**
 * Entries are logged as a readable sentence rather than as `JSON.stringify` of
 * the stored document, which previously exposed ObjectIds and internal field
 * names to whoever opened the customer's history tab.
 */
async function createAuditLog(
  prisma: PrismaClient,
  input: {
    customerId: string;
    performedById: string;
    type: "entry_added" | "entry_updated" | "entry_deleted";
    title: string;
    ledgerId: string;
    ledgerDate: string;
    oldEntry?: unknown;
    newEntry?: unknown;
  },
) {
  await prisma.auditLog.create({
    data: {
      customerId: input.customerId,
      type: input.type,
      title: input.title,
      details: [
        change(
          AUDIT_FIELD.entry,
          describeLedgerEntry(input.oldEntry as never) || "None",
          describeLedgerEntry(input.newEntry as never) || "None",
        ),
        change("Ledger date", "", formatDisplayDate(input.ledgerDate)),
      ],
      performedById: input.performedById,
      relatedEntityType: "ledger",
      relatedEntityId: input.ledgerId,
    },
  });
}

const DISPLAY_DATE_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "05 Mar 2026" from a YYYY-MM-DD business date. */
function formatDisplayDate(dateString: string) {
  const parsed = new Date(`${dateString}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime())
    ? dateString
    : DISPLAY_DATE_FORMATTER.format(parsed);
}

function buildLedgerWhere(customerId: string, query: DailyLedgerListQuery) {
  const where: {
    customerId: string;
    ledgerDate?: {
      gte: Date;
      lt: Date;
    };
  } = {
    customerId,
  };

  if (
    query.month !== undefined &&
    query.year !== undefined
  ) {
    const startDate = new Date(
      Date.UTC(
        query.year,
        query.month - 1,
        1,
      ),
    );

    const endDate = new Date(
      Date.UTC(
        query.month === 12
          ? query.year + 1
          : query.year,
        query.month === 12
          ? 0
          : query.month,
        1,
      ),
    );

    where.ledgerDate = {
      gte: startDate,
      lt: endDate,
    };
  }

  return where;
}

function buildLedgerPageInfo(totalItems: number, page: number, limit: number) {
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);

  return {
    skip: (safePage - 1) * limit,
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

export async function createTodayLedger(
  app: FastifyInstance,
  customerId: string,
  performedById: string,
  input: CreateDailyLedgerRequest,
): Promise<DailyLedgerResponse> {
  const prisma = getPrisma(app);

  const assignment = await getActiveAssignmentOrThrow(
    prisma,
    customerId,
  );

  const ledgerDate = dateStringToBusinessDate(
    getTodayBusinessDateString(),
  );

  const existing =
    await prisma.dailyLedger.findUnique({
      where: {
        customerId_ledgerDate: {
          customerId,
          ledgerDate,
        },
      },
      select: LEDGER_SELECT,
    });

  if (existing) {
    const userIds = [
      existing.updatedBy.id,
      ...(existing.entries ?? []).map(
        (entry: any) => entry.createdById,
      ),
    ];

    const userSummaryMap =
      await loadUserSummaryMap(
        prisma,
        userIds,
      );

    return normalizeLedger(
      existing,
      userSummaryMap,
    );
  }

  const ledger =
    await prisma.dailyLedger.create({
      data: {
        customerId,
        cardAssignmentId: assignment.id,
        ledgerDate,
        entries: [],
        updatedById: performedById,
      },
      select: LEDGER_SELECT,
    });

  return normalizeLedger(ledger);
}

export async function getTodayLedger(
  app: FastifyInstance,
  customerId: string,
): Promise<DailyLedgerResponse> {
  const prisma = getPrisma(app);

  const ledgerDate = dateStringToBusinessDate(
    getTodayBusinessDateString(),
  );

  const ledger =
    await prisma.dailyLedger.findUnique({
      where: {
        customerId_ledgerDate: {
          customerId,
          ledgerDate,
        },
      },
      select: LEDGER_SELECT,
    });

  if (!ledger) {
    throw createHttpError(
      404,
      "Today's ledger not found",
    );
  }

  const userIds = [
    ledger.updatedBy.id,
    ...(ledger.entries ?? []).map(
      (entry: any) => entry.createdById,
    ),
  ];

  const userSummaryMap =
    await loadUserSummaryMap(
      prisma,
      userIds,
    );

  return normalizeLedger(
    ledger,
    userSummaryMap,
  );
}

export async function getLedgerByDate(
  app: FastifyInstance,
  customerId: string,
  date: string,
): Promise<DailyLedgerResponse> {
  const prisma = getPrisma(app);

  /**
   * Important performance optimization:
   *
   * The previous implementation first queried the customer and
   * then queried the ledger. The ledger already contains the
   * required customer relation, so the extra customer query is
   * unnecessary.
   */
  const ledger = await getLedgerOrThrow(
    prisma,
    customerId,
    date,
  );

  const userIds = [
    ledger.updatedBy.id,
    ...(ledger.entries ?? []).map(
      (entry: any) => entry.createdById,
    ),
  ];

  /**
   * One user query regardless of the number of entries.
   *
   * Previously:
   *   entry 1 -> user query
   *   entry 2 -> user query
   *   entry 3 -> user query
   *   ...
   *
   * Now:
   *   all unique users -> one query
   */
  const userSummaryMap =
    await loadUserSummaryMap(
      prisma,
      userIds,
    );

  return normalizeLedger(
    ledger,
    userSummaryMap,
  );
}

export async function getCustomerLedgers(
  app: FastifyInstance,
  customerId: string,
  query: DailyLedgerListQuery,
): Promise<DailyLedgerListResponse> {
  const prisma = getPrisma(app);

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const where = buildLedgerWhere(customerId, query);

  /**
   * Only the requested page is loaded. Previously every ledger the customer
   * had ever had was pulled into memory just to slice one page out of it.
   */
  const totalItems = await prisma.dailyLedger.count({ where });
  const { skip, pageInfo } = buildLedgerPageInfo(totalItems, page, limit);

  const ledgers = await prisma.dailyLedger.findMany({
    where,
    orderBy: { ledgerDate: "desc" },
    skip,
    take: limit,
    select: LEDGER_SELECT,
  });

  // One user lookup for the whole page, not one per entry.
  const userIds = ledgers.flatMap((ledger: any) => [
    ledger.updatedBy.id,
    ...(ledger.entries ?? []).map((entry: any) => entry.createdById),
  ]);

  const userSummaryMap = await loadUserSummaryMap(prisma, userIds);

  return {
    items: ledgers.map((ledger: unknown) => normalizeLedgerListItem(ledger, userSummaryMap)),
    pageInfo,
  };
}

export async function getCustomerLedgerSummary(
  app: FastifyInstance,
  customerId: string,
  query: DailyLedgerListQuery,
): Promise<DailyLedgerSummaryResponse> {
  const prisma = getPrisma(app);

  // The summary only needs the entry arrays, so it skips the customer, card
  // and user joins that the list query performs.
  const ledgers: Array<{ entries: unknown[] }> = await prisma.dailyLedger.findMany({
    where: buildLedgerWhere(customerId, query),
    select: { entries: true },
  });

  return {
    totalLedgers: ledgers.length,

    totalEntries: ledgers.reduce(
      (sum: number, ledger: { entries: unknown[] }) =>
        sum + (ledger.entries?.length ?? 0),
      0,
    ),

    totalMilkLitres: ledgers.reduce(
      (sum: number, ledger: { entries: unknown[] }) =>
        sum +
        (ledger.entries ?? []).reduce(
          (entrySum: number, entry: any) =>
            entrySum +
            (entry.milkEntries ?? []).reduce(
              (milkSum: number, milkEntry: any) =>
                milkSum +
                (milkEntry.litres ?? 0),
              0,
            ),
          0,
        ),
      0,
    ),

    totalMilkAmount: ledgers.reduce(
      (sum: number, ledger: { entries: unknown[] }) =>
        sum +
        (ledger.entries ?? []).reduce(
          (entrySum: number, entry: any) =>
            entrySum +
            (entry.milkEntries ?? []).reduce(
              (milkSum: number, milkEntry: any) =>
                milkSum +
                (milkEntry.amount ?? 0),
              0,
            ),
          0,
        ),
      0,
    ),

    totalProductAmount: ledgers.reduce(
      (sum: number, ledger: { entries: unknown[] }) =>
        sum +
        (ledger.entries ?? []).reduce(
          (entrySum: number, entry: any) =>
            entrySum +
            (entry.productEntries ?? []).reduce(
              (productSum: number, productEntry: any) =>
                productSum +
                (productEntry.amount ?? 0),
              0,
            ),
          0,
        ),
      0,
    ),

    grandTotal: ledgers.reduce(
      (sum: number, ledger: { entries: unknown[] }) =>
        sum +
        (ledger.entries ?? []).reduce(
          (entrySum: number, entry: any) =>
            entrySum +
            (entry.totalAmount ?? 0),
          0,
        ),
      0,
    ),
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

  const assignment =
    await getAssignmentForLedgerDateOrThrow(
      prisma,
      customerId,
      date,
    );

  const ledgerDate =
    dateStringToBusinessDate(date);

  const [
    milkEntries,
    productEntries,
  ] = await Promise.all([
    resolveMilkEntries(
      prisma,
      input.milkEntries,
    ),
    resolveProductEntries(
      prisma,
      input.productEntries ?? [],
    ),
  ]);

  const totals = calculateEntryTotals({
    milkEntries,
    productEntries,
  });

  const entry = {
    createdAt: new Date(),
    createdById: performedById,
    clientRequestId:
      input.clientRequestId ?? "",
    milkEntries,
    productEntries,
    notes: input.notes ?? "",
    totalAmount: totals.totalAmount,
  };

  const result =
    await prisma.$transaction(
      async (tx: PrismaClient) => {
        const existing =
          await tx.dailyLedger.findUnique({
            where: {
              customerId_ledgerDate: {
                customerId,
                ledgerDate,
              },
            },
            select: {
              id: true,
              entries: true,
            },
          });

        if (!existing) {
          const ledger =
            await tx.dailyLedger.create({
              data: {
                customerId,
                cardAssignmentId:
                  assignment.id,
                ledgerDate,
                entries: [entry],
                updatedById:
                  performedById,
              },
              select: LEDGER_SELECT,
            });

          return {
            ledger,
            added: true,
          };
        }

        if (
          input.clientRequestId &&
          existing.entries.some(
            (existingEntry: any) =>
              existingEntry.clientRequestId ===
              input.clientRequestId,
          )
        ) {
          const ledger =
            await tx.dailyLedger.findUniqueOrThrow({
              where: {
                id: existing.id,
              },
              select: LEDGER_SELECT,
            });

          return {
            ledger,
            added: false,
          };
        }

        const ledger =
          await tx.dailyLedger.update({
            where: {
              id: existing.id,
            },
            data: {
              entries: [
                ...(existing.entries ?? []),
                entry,
              ],
              updatedById:
                performedById,
            },
            select: LEDGER_SELECT,
          });

        return {
          ledger,
          added: true,
        };
      },
    );

  if (result.added) {
    await createAuditLog(prisma, {
      customerId,
      performedById,
      type: "entry_added",
      title: `Ledger entry added for ${formatDisplayDate(date)}`,
      ledgerId: result.ledger.id,
      ledgerDate: date,
      newEntry: entry,
    });
  }

  const userIds = [
    result.ledger.updatedBy.id,
    ...(result.ledger.entries ?? []).map(
      (item: any) =>
        item.createdById,
    ),
  ];

  const userSummaryMap =
    await loadUserSummaryMap(
      prisma,
      userIds,
    );

  return normalizeLedger(
    result.ledger,
    userSummaryMap,
  );
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

  const ledger =
    await getLedgerOrThrow(
      prisma,
      customerId,
      date,
    );

  if (
    entryIndex < 0 ||
    entryIndex >=
      (ledger.entries?.length ?? 0)
  ) {
    throw createHttpError(
      404,
      "Ledger entry not found",
    );
  }

  if (
    input.milkEntries === undefined &&
    input.productEntries === undefined &&
    input.notes === undefined
  ) {
    throw createHttpError(
      400,
      "At least one field is required",
    );
  }

  const oldEntry =
    ledger.entries[entryIndex];

  if (!oldEntry) {
    throw createHttpError(
      404,
      "Ledger entry not found",
    );
  }

  const [
    nextMilkEntries,
    nextProductEntries,
  ] = await Promise.all([
    input.milkEntries !== undefined
      ? resolveMilkEntries(
          prisma,
          input.milkEntries,
        )
      : Promise.resolve(
          oldEntry.milkEntries ?? [],
        ),

    input.productEntries !== undefined
      ? resolveProductEntries(
          prisma,
          input.productEntries,
        )
      : Promise.resolve(
          oldEntry.productEntries ?? [],
        ),
  ]);

  if (
    nextMilkEntries.length === 0 &&
    nextProductEntries.length === 0
  ) {
    throw createHttpError(
      400,
      "At least one entry is required",
    );
  }

  const totals = calculateEntryTotals({
    milkEntries: nextMilkEntries,
    productEntries: nextProductEntries,
  });

  const nextEntry = {
    createdAt:
      oldEntry.createdAt ??
      new Date(),
    createdById:
      oldEntry.createdById ??
      performedById,
    clientRequestId:
      oldEntry.clientRequestId ??
      "",
    milkEntries:
      nextMilkEntries,
    productEntries:
      nextProductEntries,
    notes:
      input.notes !== undefined
        ? input.notes
        : (oldEntry.notes ?? ""),
    totalAmount:
      totals.totalAmount,
  };

  const nextEntries = [
    ...ledger.entries,
  ];

  nextEntries[entryIndex] =
    nextEntry;

  const updatedLedger =
    await prisma.dailyLedger.update({
      where: {
        id: ledger.id,
      },
      data: {
        entries: nextEntries,
        updatedById:
          performedById,
      },
      select: LEDGER_SELECT,
    });

  await createAuditLog(prisma, {
    customerId,
    performedById,
    type: "entry_updated",
    title: `Ledger entry updated for ${formatDisplayDate(date)}`,
    ledgerId: updatedLedger.id,
    ledgerDate: date,
    oldEntry,
    newEntry: nextEntry,
  });

  const userIds = [
    updatedLedger.updatedBy.id,
    ...(updatedLedger.entries ?? []).map(
      (item: any) =>
        item.createdById,
    ),
  ];

  const userSummaryMap =
    await loadUserSummaryMap(
      prisma,
      userIds,
    );

  return normalizeLedger(
    updatedLedger,
    userSummaryMap,
  );
}

export async function deleteLedgerEntry(
  app: FastifyInstance,
  customerId: string,
  performedById: string,
  date: string,
  entryIndex: number,
): Promise<DailyLedgerResponse> {
  const prisma = getPrisma(app);

  const ledger =
    await getLedgerOrThrow(
      prisma,
      customerId,
      date,
    );

  if (
    entryIndex < 0 ||
    entryIndex >=
      (ledger.entries?.length ?? 0)
  ) {
    throw createHttpError(
      404,
      "Ledger entry not found",
    );
  }

  const oldEntry =
    ledger.entries[entryIndex];

  const nextEntries =
    ledger.entries.filter(
      (_: any, index: number) =>
        index !== entryIndex,
    );

  const updatedLedger =
    await prisma.dailyLedger.update({
      where: {
        id: ledger.id,
      },
      data: {
        entries: nextEntries,
        updatedById:
          performedById,
      },
      select: LEDGER_SELECT,
    });

  await createAuditLog(prisma, {
    customerId,
    performedById,
    type: "entry_deleted",
    title: `Ledger entry deleted for ${formatDisplayDate(date)}`,
    ledgerId: updatedLedger.id,
    ledgerDate: date,
    oldEntry,
  });

  const userIds = [
    updatedLedger.updatedBy.id,
    ...(updatedLedger.entries ?? []).map(
      (item: any) =>
        item.createdById,
    ),
  ];

  const userSummaryMap =
    await loadUserSummaryMap(
      prisma,
      userIds,
    );

  return normalizeLedger(
    updatedLedger,
    userSummaryMap,
  );
}