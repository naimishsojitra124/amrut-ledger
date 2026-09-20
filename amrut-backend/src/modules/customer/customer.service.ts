import type { FastifyInstance } from "fastify";
import type { PaymentMethod, Prisma, PrismaClient } from "../../../generated/prisma/client";
import type { BillStatus } from "../../../generated/prisma/enums";
import type {
  CustomerAuditLogItemResponse,
  CustomerAuditLogResponse,
  CustomerBillListResponse,
  CustomerCardAssignmentResponse,
  CustomerCardResponse,
  CustomerDailyHistoryItemResponse,
  CustomerDailyHistoryResponse,
  CustomerListQuery,
  CustomerListResponse,
  CustomerPaymentListResponse,
  CustomerResponse,
  CustomerStatsResponse,
  CreateCustomerRequest,
  PageInfo,
  UpdateCustomerRequest,
} from "./customer.types";
import { CardAssignmentSummaryResponse } from "../cards/card.types";
import { normalizeAssignment } from "../cards/card.service";
import {
  AUDIT_FIELD,
  change,
  collectChanges,
  describeMilkType,
  describeMilkTypeList,
  formatBillPeriod,
  formatMoney,
  moneyChange,
} from "../audit/audit.util";
import { TX_OPTIONS } from "@/app/db/transaction";

type CardAssignmentWithRelations = Prisma.CardAssignmentGetPayload<{
  include: {
    customer: true;
    assignedBy: true;
    card: true;
  };
}>;

type DailyLedgerRecord = Prisma.DailyLedgerGetPayload<{}>;

interface CustomerAuditLogDetail {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

interface CustomerAuditLogDetailResponse {
  field: string;
  oldValue: string;
  newValue: string;
}

type CustomerAuditLogRecord = Prisma.AuditLogGetPayload<{
  select: {
    id: true;
    type: true;
    title: true;
    details: true;
    performedAt: true;
    relatedEntityType: true;
    relatedEntityId: true;
    performedBy: {
      select: {
        id: true;
        fullName: true;
      };
    };
  };
}>;

interface CustomerBillsQuery {
  page?: number | undefined;
  limit?: number | undefined;
  month?: number | undefined;
  year?: number | undefined;
  status?: BillStatus | undefined;
  search?: string | undefined;
}

type CustomerBillListItem = CustomerBillListResponse["items"][number];

type CustomerBillRecord = Prisma.BillGetPayload<{
  include: {
    customer: {
      select: {
        id: true;
        fullName: true;
        mobileNumber: true;
      };
    };
    cardAssignment: {
      select: {
        id: true;
        cardId: true;
        assignedAt: true;
        unassignedAt: true;
        depositAtAssignment: true;
        card: {
          select: {
            cardNumber: true;
          };
        };
      };
    };
  };
}>;
interface CustomerPaymentRecord extends Prisma.PaymentGetPayload<{
  include: {
    customer: {
      select: {
        id: true;
        fullName: true;
        mobileNumber: true;
      };
    };
    bill: {
      select: {
        id: true;
        billNumber: true;
        month: true;
        year: true;
        status: true;
        outstandingAmount: true;
      };
    };
    receivedBy: {
      select: {
        id: true;
        fullName: true;
      };
    };
    editedBy: {
      select: {
        id: true;
        fullName: true;
      };
    };
  };
}> {}

function createHttpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}

function getPrisma(app: FastifyInstance) {
  return (app as FastifyInstance & { prisma: PrismaClient }).prisma;
}

/**
 * Audit rows are collected while a transaction runs and written in one go.
 *
 * `create` round-trips twice (insert, then read the row back); `createMany`
 * does neither, so batching four audit writes saves eight round trips.
 */
type PendingAuditLog = {
  customerId: string;
  type: any;
  title: string;
  details: { field: string; oldValue: string; newValue: string }[];
  performedById: string;
  relatedEntityType?: any;
  relatedEntityId?: string | null;
};

function makeAuditCollector() {
  const entries: PendingAuditLog[] = [];

  return {
    add(entry: PendingAuditLog) {
      entries.push(entry);
    },
    async flush(tx: PrismaClient) {
      if (entries.length === 0) return;

      await tx.auditLog.createMany({
        data: entries.map((entry) => ({
          customerId: entry.customerId,
          type: entry.type,
          title: entry.title,
          details: entry.details,
          performedById: entry.performedById,
          relatedEntityType: entry.relatedEntityType ?? null,
          relatedEntityId: entry.relatedEntityId ?? null,
        })) as any,
      });
    },
  };
}

function getSearchName(fullName: string) {
  return fullName.trim().toLowerCase();
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function normalizeCardAssignment(assignment: any): CustomerCardResponse {
  return {
    cardId: assignment.cardId,
    cardNumber: assignment.card?.cardNumber ?? 0,
    status: assignment.card?.status ?? "available",
    assignedAt: assignment.assignedAt.toISOString(),
    unassignedAt: toIso(assignment.unassignedAt),
    depositAtAssignment: assignment.depositAtAssignment ?? 0,
  };
}

async function loadMilkTypeMap(
  prisma: PrismaClient,
  milkTypes: { milkTypeId: string; isDefault: boolean }[],
) {
  const ids = [...new Set(milkTypes.map((item) => item.milkTypeId))];

  const dbMilkTypes = await prisma.milkType.findMany({
    where: { id: { in: ids }, status: "active" },
  });

  if (dbMilkTypes.length !== ids.length) {
    throw createHttpError(400, "One or more milk types are invalid or inactive");
  }

  const byId = new Map(dbMilkTypes.map((item) => [item.id, item]));
  return milkTypes.map((item) => {
    const dbItem = byId.get(item.milkTypeId)!;
    return {
      milkTypeId: dbItem.id,
      milkTypeName: dbItem.name,
      shortCode: dbItem.shortCode,
      rate: dbItem.rate,
      isDefault: item.isDefault,
    };
  });
}

const CUSTOMER_LIST_SELECT = {
  id: true,
  fullName: true,
  searchName: true,
  mobileNumber: true,
  address: true,
  depositAmount: true,
  status: true,
  milkTypes: true,
  notes: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerSelect;

const CUSTOMER_MILK_TYPE_SELECT = {
  id: true,
  name: true,
  shortCode: true,
  rate: true,
} satisfies Prisma.MilkTypeSelect;

const CUSTOMER_CARD_ASSIGNMENT_SELECT = {
  customerId: true,
  cardId: true,
  assignedAt: true,
  unassignedAt: true,
  depositAtAssignment: true,
  card: {
    select: {
      cardNumber: true,
      status: true,
    },
  },
} satisfies Prisma.CardAssignmentSelect;

async function loadCustomerCurrentCard(prisma: PrismaClient, customerId: string) {
  const assignment = await prisma.cardAssignment.findFirst({
    where: { customerId, unassignedAt: null },
    orderBy: { assignedAt: "desc" },
    select: CUSTOMER_CARD_ASSIGNMENT_SELECT,
  });

  return assignment ? normalizeCardAssignment(assignment) : null;
}

async function loadCustomerMilkTypes(prisma: PrismaClient, customer: any) {
  const embedded = (customer.milkTypes ?? []) as { milkTypeId: string; isDefault: boolean }[];
  const ids = [...new Set(embedded.map((item) => item.milkTypeId))];

  if (ids.length === 0) return [];

  const dbMilkTypes = await prisma.milkType.findMany({
    where: { id: { in: ids } },
    select: CUSTOMER_MILK_TYPE_SELECT,
  });

  const byId = new Map(dbMilkTypes.map((item) => [item.id, item]));
  return embedded.map((item) => {
    const dbItem = byId.get(item.milkTypeId);
    return {
      milkTypeId: item.milkTypeId,
      milkTypeName: dbItem?.name ?? "Unknown",
      shortCode: dbItem?.shortCode ?? "",
      rate: dbItem?.rate ?? 0,
      isDefault: item.isDefault,
    };
  });
}

async function loadCustomerCurrentCardMap(prisma: PrismaClient, customerIds: string[]) {
  if (customerIds.length === 0) return new Map<string, CustomerCardResponse>();

  const assignments = await prisma.cardAssignment.findMany({
    where: {
      customerId: { in: customerIds },
      unassignedAt: null,
    },
    orderBy: { assignedAt: "desc" },
    select: CUSTOMER_CARD_ASSIGNMENT_SELECT,
  });

  const map = new Map<string, CustomerCardResponse>();
  for (const assignment of assignments) {
    if (!map.has(assignment.customerId)) {
      map.set(assignment.customerId, normalizeCardAssignment(assignment));
    }
  }

  return map;
}

async function loadCustomerMilkTypesMap(
  prisma: PrismaClient,
  customers: Array<{
    id: string;
    milkTypes: unknown;
  }>,
) {
  const embeddedByCustomer = new Map<string, { milkTypeId: string; isDefault: boolean }[]>();
  const milkTypeIds = new Set<string>();

  for (const customer of customers) {
    const embedded = (customer.milkTypes ?? []) as {
      milkTypeId: string;
      isDefault: boolean;
    }[];

    embeddedByCustomer.set(customer.id, embedded);
    for (const item of embedded) milkTypeIds.add(item.milkTypeId);
  }

  if (milkTypeIds.size === 0) {
    return new Map<string, CustomerResponse["milkTypes"]>();
  }

  const dbMilkTypes = await prisma.milkType.findMany({
    where: { id: { in: [...milkTypeIds] } },
    select: CUSTOMER_MILK_TYPE_SELECT,
  });

  const byId = new Map(dbMilkTypes.map((item) => [item.id, item]));
  const result = new Map<string, CustomerResponse["milkTypes"]>();

  for (const [customerId, embedded] of embeddedByCustomer) {
    result.set(
      customerId,
      embedded.map((item) => {
        const dbItem = byId.get(item.milkTypeId);
        return {
          milkTypeId: item.milkTypeId,
          milkTypeName: dbItem?.name ?? "Unknown",
          shortCode: dbItem?.shortCode ?? "",
          rate: dbItem?.rate ?? 0,
          isDefault: item.isDefault,
        };
      }),
    );
  }

  return result;
}

async function loadCustomerOutstandingMap(prisma: PrismaClient, customerIds: string[]) {
  if (customerIds.length === 0) return new Map<string, number>();

  const rows = await prisma.bill.groupBy({
    by: ["customerId"],
    where: {
      customerId: { in: customerIds },
    },
    _sum: {
      outstandingAmount: true,
    },
  });

  return new Map(rows.map((row) => [row.customerId, row._sum.outstandingAmount ?? 0]));
}

async function loadCustomerLastEntryMap(prisma: PrismaClient, customerIds: string[]) {
  if (customerIds.length === 0) return new Map<string, string | null>();

  const rows = await prisma.dailyLedger.groupBy({
    by: ["customerId"],
    where: {
      customerId: { in: customerIds },
    },
    _max: {
      ledgerDate: true,
    },
  });

  return new Map(
    rows.map((row) => [
      row.customerId,
      row._max.ledgerDate ? row._max.ledgerDate.toISOString() : null,
    ]),
  );
}

async function normalizeCustomer(prisma: PrismaClient, customer: any): Promise<CustomerResponse> {
  const [milkTypes, currentCard, outstandingAmount, lastEntryAt] = await Promise.all([
    loadCustomerMilkTypes(prisma, customer),
    loadCustomerCurrentCard(prisma, customer.id),
    loadCustomerOutstandingMap(prisma, [customer.id]),
    loadCustomerLastEntryMap(prisma, [customer.id]),
  ]);

  return {
    id: customer.id,
    fullName: customer.fullName,
    searchName: customer.searchName,
    mobileNumber: customer.mobileNumber ?? "",
    address: customer.address,
    depositAmount: customer.depositAmount ?? 0,
    status: customer.status,
    milkTypes,
    currentCard,
    outstandingAmount: outstandingAmount.get(customer.id) ?? 0,
    lastEntryAt: lastEntryAt.get(customer.id) ?? null,
    notes: customer.notes ?? "",
    archivedAt: toIso(customer.archivedAt),
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}

export function buildPageInfo(totalItems: number, page: number, limit: number): PageInfo {
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * Mobile numbers are optional. A blank string is stored as "no number" rather
 * than as an empty value so that searching, display and duplicate reporting
 * all treat "not provided" the same way.
 */
function normalizeMobileNumber(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Several customers may legitimately share a household phone, so the number is
 * not unique. We still warn about an exact re-use because it is more often a
 * typo than a genuine shared line.
 */
async function findCustomersSharingMobile(
  prisma: PrismaClient,
  mobileNumber: string | null,
  excludeCustomerId: string | null,
) {
  if (!mobileNumber) return [];

  return prisma.customer.findMany({
    where: {
      mobileNumber,
      ...(excludeCustomerId ? { id: { not: excludeCustomerId } } : {}),
    },
    select: { id: true, fullName: true },
    take: 5,
  });
}

async function writeAuditLog(
  tx: PrismaClient,
  data: {
    customerId: string;
    type: any;
    title: string;
    details?: { field: string; oldValue: string; newValue: string }[];
    performedById: string;
    relatedEntityType?: any;
    relatedEntityId?: string | null;
  },
) {
  await tx.auditLog.create({
    data: {
      customerId: data.customerId,
      type: data.type,
      title: data.title,
      details: data.details ?? [],
      performedById: data.performedById,
      relatedEntityType: data.relatedEntityType ?? null,
      relatedEntityId: data.relatedEntityId ?? null,
    } as any,
  });
}

async function getNextCardNumber(tx: PrismaClient) {
  const lastCard = await tx.card.findFirst({
    orderBy: { cardNumber: "desc" },
  });

  return (lastCard?.cardNumber ?? 0) + 1;
}

async function resolveCardForCustomer(tx: PrismaClient, inputCardNumber: number | undefined) {
  if (inputCardNumber !== undefined) {
    const existing = await tx.card.findUnique({
      where: { cardNumber: inputCardNumber },
    });

    if (existing) return existing;

    return tx.card.create({
      data: {
        cardNumber: inputCardNumber,
        status: "available",
      },
    });
  }

  const available = await tx.card.findFirst({
    where: { status: "available" },
    orderBy: { cardNumber: "asc" },
  });

  if (available) return available;

  const nextCardNumber = await getNextCardNumber(tx);
  return tx.card.create({
    data: {
      cardNumber: nextCardNumber,
      status: "available",
    },
  });
}

async function closeActiveAssignmentIfAny(
  tx: PrismaClient,
  customerId: string,
  closedAt: Date,
  performedById: string,
) {
  const activeAssignment = await tx.cardAssignment.findFirst({
    where: {
      customerId,
      unassignedAt: null,
    },
    include: {
      card: true,
      customer: true,
      assignedBy: true,
    },
    orderBy: {
      assignedAt: "desc",
    },
  });

  if (!activeAssignment) return null;

  await tx.cardAssignment.update({
    where: { id: activeAssignment.id },
    data: { unassignedAt: closedAt },
  });

  await tx.card.update({
    where: { id: activeAssignment.cardId },
    data: { status: "available" },
  });

  await writeAuditLog(tx, {
    customerId,
    type: "card_unassigned",
    title: `Card ${activeAssignment.card.cardNumber} unassigned`,
    details: [change(AUDIT_FIELD.cardNumber, activeAssignment.card.cardNumber, "None")],
    performedById,
    relatedEntityType: "cardAssignment",
    relatedEntityId: activeAssignment.id,
  });

  return activeAssignment;
}

async function assignCardToCustomer(
  tx: PrismaClient,
  customerId: string,
  cardNumber: number | undefined,
  assignedById: string,
  assignedAt: Date,
  depositAtAssignment: number,
) {
  const card = await resolveCardForCustomer(tx, cardNumber);

  const activeAssignmentForCard = await tx.cardAssignment.findFirst({
    where: {
      cardId: card.id,
      unassignedAt: null,
    },
  });

  if (activeAssignmentForCard && activeAssignmentForCard.customerId !== customerId) {
    throw createHttpError(409, "Card is already assigned to another customer");
  }

  const activeAssignmentForCustomer = await tx.cardAssignment.findFirst({
    where: {
      customerId,
      unassignedAt: null,
    },
  });

  if (activeAssignmentForCustomer && activeAssignmentForCustomer.cardId === card.id) {
    return { card, assignmentId: activeAssignmentForCustomer.id };
  }

  if (activeAssignmentForCustomer) {
    // Load the card so the log can name it. `cardId` is a database identifier
    // and must never reach the audit trail the user reads.
    const previousCard = await tx.card.findUnique({
      where: { id: activeAssignmentForCustomer.cardId },
      select: { cardNumber: true },
    });

    await tx.cardAssignment.update({
      where: { id: activeAssignmentForCustomer.id },
      data: { unassignedAt: assignedAt },
    });

    await tx.card.update({
      where: { id: activeAssignmentForCustomer.cardId },
      data: { status: "available" },
    });

    await writeAuditLog(tx, {
      customerId,
      type: "card_unassigned",
      title: `Card ${previousCard?.cardNumber ?? ""} unassigned`.replace("Card  ", "Card "),
      details: [change(AUDIT_FIELD.cardNumber, previousCard?.cardNumber ?? "", "None")],
      performedById: assignedById,
      relatedEntityType: "cardAssignment",
      relatedEntityId: activeAssignmentForCustomer.id,
    });
  }

  await tx.card.update({
    where: { id: card.id },
    data: { status: "assigned" },
  });

  const assignment = await tx.cardAssignment.create({
    data: {
      cardId: card.id,
      customerId,
      assignedAt,
      unassignedAt: null,
      depositAtAssignment,
      assignedById,
    },
  });

  await writeAuditLog(tx, {
    customerId,
    type: "card_assigned",
    title: `Card ${card.cardNumber} assigned`,
    details: [change(AUDIT_FIELD.cardNumber, "None", card.cardNumber)],
    performedById: assignedById,
    relatedEntityType: "cardAssignment",
    relatedEntityId: assignment.id,
  });

  return { card, assignmentId: assignment.id };
}

async function buildCustomerListWhere(prisma: PrismaClient, query: CustomerListQuery) {
  const where: Prisma.CustomerWhereInput = {};

  if (query.status) where.status = query.status;

  const search = query.search?.trim();
  if (search) {
    const customerFieldMatches: Prisma.CustomerWhereInput[] = [
      { fullName: { contains: search, mode: "insensitive" } },
      { mobileNumber: { contains: search } },
      { searchName: { contains: search, mode: "insensitive" } },
    ];

    if (/^\d+$/.test(search)) {
      // Card numbers are Ints, so Prisma cannot substring-match them. Matching
      // on the exact number keeps this to one indexed lookup; the previous
      // implementation loaded every card in the system on each keystroke.
      const cardNumber = Number(search);

      if (Number.isSafeInteger(cardNumber) && cardNumber > 0) {
        const matchingAssignments = await prisma.cardAssignment.findMany({
          where: {
            unassignedAt: null,
            card: { is: { cardNumber } },
          },
          select: { customerId: true },
          take: 100,
        });

        if (matchingAssignments.length > 0) {
          customerFieldMatches.push({
            id: { in: [...new Set(matchingAssignments.map((item) => item.customerId))] },
          });
        }
      }
    }

    where.OR = customerFieldMatches;
  }

  return where;
}

async function fetchCustomerBaseList(
  prisma: PrismaClient,
  query: CustomerListQuery,
  page: number,
  limit: number,
) {
  const where = await buildCustomerListWhere(prisma, query);
  const skip = (page - 1) * limit;

  const [totalItems, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: [{ createdAt: "asc" }],
      skip,
      take: limit,
      select: CUSTOMER_LIST_SELECT,
    }),
  ]);

  const customerIds = customers.map((customer) => customer.id);

  const [outstandingByCustomer, lastEntryByCustomer, currentCardByCustomer, milkTypesByCustomer] =
    await Promise.all([
      loadCustomerOutstandingMap(prisma, customerIds),
      loadCustomerLastEntryMap(prisma, customerIds),
      loadCustomerCurrentCardMap(prisma, customerIds),
      loadCustomerMilkTypesMap(prisma, customers),
    ]);

  const normalized = customers.map((customer) => ({
    id: customer.id,
    fullName: customer.fullName,
    searchName: customer.searchName,
    mobileNumber: customer.mobileNumber ?? "",
    address: customer.address,
    depositAmount: customer.depositAmount ?? 0,
    status: customer.status,
    milkTypes: milkTypesByCustomer.get(customer.id) ?? [],
    currentCard: currentCardByCustomer.get(customer.id) ?? null,
    outstandingAmount: outstandingByCustomer.get(customer.id) ?? 0,
    lastEntryAt: lastEntryByCustomer.get(customer.id) ?? null,
    notes: customer.notes ?? "",
    archivedAt: toIso(customer.archivedAt),
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  }));

  return { totalItems, items: normalized };
}

export async function getCustomers(
  app: FastifyInstance,
  query: CustomerListQuery,
): Promise<CustomerListResponse> {
  const prisma = getPrisma(app);
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;

  const { totalItems, items } = await fetchCustomerBaseList(prisma, query, page, limit);
  const pageInfo = buildPageInfo(totalItems, page, limit);

  return {
    items,
    pageInfo,
  };
}

export async function getCustomerByCardNumber(
  app: FastifyInstance,
  cardNumber: number,
): Promise<CustomerResponse> {
  const prisma = getPrisma(app);

  const assignment = await prisma.cardAssignment.findFirst({
    where: {
      unassignedAt: null,
      card: {
        cardNumber,
      },
    },
    orderBy: { assignedAt: "desc" },
    select: {
      customerId: true,
    },
  });

  if (!assignment) {
    throw createHttpError(404, "No active customer found for this card");
  }

  const customer = await prisma.customer.findUnique({
    where: { id: assignment.customerId },
    select: CUSTOMER_LIST_SELECT,
  });

  if (!customer || customer.status !== "active") {
    throw createHttpError(404, "No active customer found for this card");
  }

  return normalizeCustomer(prisma, customer);
}

export async function getCustomerById(app: FastifyInstance, id: string): Promise<CustomerResponse> {
  const prisma = getPrisma(app);

  const customer = await prisma.customer.findUnique({
    where: { id },
  });

  if (!customer) throw createHttpError(404, "Customer not found");

  return normalizeCustomer(prisma, customer);
}

export async function getCustomerStats(app: FastifyInstance): Promise<CustomerStatsResponse> {
  const prisma = getPrisma(app);

  const [totalCustomers, activeCustomers, archivedCustomers, totalDeposit] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({ where: { status: "active" } }),
    prisma.customer.count({ where: { status: "archived" } }),
    prisma.customer.aggregate({
      _sum: {
        depositAmount: true,
      },
    }),
  ]);

  // A customer is considered to have a card when they have at least one
  // active card assignment. Grouping by customerId preserves that behavior
  // without loading every customer document into application memory.
  const customersWithActiveCard = await prisma.cardAssignment.groupBy({
    by: ["customerId"],
    where: { unassignedAt: null },
  });

  const customersWithCard = customersWithActiveCard.length;

  return {
    // Keep dashboard and customer-list consumers on the same contract.
    totalActiveCustomers: activeCustomers,
    totalClosedCustomers: archivedCustomers,
    totalOutstanding: 0,
    totalCustomers,
    activeCustomers,
    archivedCustomers,
    customersWithCard,
    customersWithoutCard: totalCustomers - customersWithCard,
    totalDepositAmount: totalDeposit._sum.depositAmount ?? 0,
  };
}

/** "OPEN-08-2026-47" — distinct from the "BILL-..." series at a glance. */
export function getOpeningBalanceBillNumber(month: number, year: number, cardNumber: number) {
  return `OPEN-${String(month).padStart(2, "0")}-${year}-${cardNumber}`;
}

/** Last day of the given month, in UTC, matching how bill dates are stored. */
function endOfMonth(month: number, year: number) {
  return new Date(Date.UTC(year, month, 0));
}

function dueDateFor(month: number, year: number) {
  return new Date(Date.UTC(year, month, 10));
}

/**
 * Finds, or creates, the Card row a new customer should be given.
 *
 * Deliberately outside the transaction: a Card is just a number and a status,
 * so one created for a request that later fails is harmless (it stays
 * available), and keeping this out of the transaction is a large part of what
 * brought customer creation back under the transaction budget.
 *
 * Whether the card is actually free is re-checked inside the transaction —
 * see `assertCardIsFree`.
 */
async function resolveCardForNewCustomer(
  prisma: PrismaClient,
  inputCardNumber: number | undefined,
) {
  if (inputCardNumber !== undefined) {
    const existing = await prisma.card.findUnique({
      where: { cardNumber: inputCardNumber },
    });

    return (
      existing ??
      (await prisma.card.create({
        data: { cardNumber: inputCardNumber, status: "available" },
      }))
    );
  }

  const available = await prisma.card.findFirst({
    where: { status: "available" },
    orderBy: { cardNumber: "asc" },
  });

  if (available) return available;

  return prisma.card.create({
    data: { cardNumber: await getNextCardNumber(prisma), status: "available" },
  });
}

/**
 * Guards against two customers being created against the same card at once.
 *
 * Runs inside the transaction, so the check and the assignment that follows it
 * cannot be interleaved with another request picking the same free card.
 */
async function assertCardIsFree(tx: PrismaClient, cardId: string, cardNumber: number) {
  const activeAssignment = await tx.cardAssignment.findFirst({
    where: { cardId, unassignedAt: null },
    select: { id: true },
  });

  if (activeAssignment) {
    throw createHttpError(409, `Card ${cardNumber} is already assigned to another customer`);
  }
}

export async function createCustomer(
  app: FastifyInstance,
  input: CreateCustomerRequest,
  performedById: string,
): Promise<CustomerResponse> {
  const prisma = getPrisma(app);

  const mobileNumber = normalizeMobileNumber(input.mobileNumber);

  if (mobileNumber && !/^\d{10}$/.test(mobileNumber)) {
    throw createHttpError(400, "Mobile number must be exactly 10 digits");
  }

  const milkTypesInput = [
    { milkTypeId: input.primaryMilkTypeId, isDefault: true },
    ...((input.otherMilkTypeIds ?? [])
      .filter((id) => id !== input.primaryMilkTypeId)
      .map((id) => ({
        milkTypeId: id,
        isDefault: false,
      })) as { milkTypeId: string; isDefault: boolean }[]),
  ];

  const openingBalance = input.openingBalance;

  if (openingBalance) {
    assertOpeningBalancePeriod(openingBalance.month, openingBalance.year);
  }

  /**
   * Everything that only reads, or that is safe to leave behind on failure,
   * happens before the transaction opens. What remains inside is the smallest
   * set of writes that must succeed or fail together.
   */
  const [milkTypes, card] = await Promise.all([
    loadMilkTypeMap(prisma, milkTypesInput),
    resolveCardForNewCustomer(prisma, input.cardNumber),
  ]);

  const createdAt = new Date();
  const depositAmount = input.depositAmount ?? 0;
  const notes = input.notes ?? "";

  const result = await prisma.$transaction(async (tx: PrismaClient) => {
    const audit = makeAuditCollector();

    await assertCardIsFree(tx, card.id, card.cardNumber);

    const customer = await tx.customer.create({
      data: {
        fullName: input.fullName.trim(),
        searchName: getSearchName(input.fullName),
        mobileNumber,
        address: input.address?.trim() ?? "",
        depositAmount,
        status: "active",
        milkTypes: milkTypes.map((item) => ({
          milkTypeId: item.milkTypeId,
          isDefault: item.isDefault,
        })) as any,
        notes,
        archivedAt: null,
        createdById: performedById,
        updatedById: performedById,
      } as any,
    });

    audit.add({
      customerId: customer.id,
      type: "customer_created",
      title: `Customer created: ${customer.fullName}`,
      details: [
        change(AUDIT_FIELD.fullName, "", customer.fullName),
        change(AUDIT_FIELD.mobileNumber, "", customer.mobileNumber ?? "Not provided"),
        change(AUDIT_FIELD.address, "", customer.address || "Not provided"),
        change(
          AUDIT_FIELD.primaryMilkType,
          "",
          describeMilkType(milkTypes.find((item) => item.isDefault) ?? null),
        ),
        ...(milkTypes.some((item) => !item.isDefault)
          ? [
              change(
                AUDIT_FIELD.otherMilkTypes,
                "",
                describeMilkTypeList(milkTypes.filter((item) => !item.isDefault)),
              ),
            ]
          : []),
        moneyChange(AUDIT_FIELD.depositBalance, 0, depositAmount),
      ],
      performedById,
    });

    // `updateMany` does not read the row back, so it costs one round trip
    // instead of two. Nothing here needs the updated card.
    await tx.card.updateMany({ where: { id: card.id }, data: { status: "assigned" } });

    const assignment = await tx.cardAssignment.create({
      data: {
        cardId: card.id,
        customerId: customer.id,
        assignedAt: createdAt,
        unassignedAt: null,
        depositAtAssignment: depositAmount,
        assignedById: performedById,
      },
    });

    audit.add({
      customerId: customer.id,
      type: "card_assigned",
      title: `Card ${card.cardNumber} assigned`,
      details: [change(AUDIT_FIELD.cardNumber, "None", card.cardNumber)],
      performedById,
      relatedEntityType: "cardAssignment",
      relatedEntityId: assignment.id,
    });

    if (depositAmount > 0) {
      await tx.depositTransaction.createMany({
        data: [
          {
            customerId: customer.id,
            type: "top_up",
            amount: depositAmount,
            balanceAfter: depositAmount,
            reference: "Customer opening deposit",
            performedById,
          },
        ],
      });

      audit.add({
        customerId: customer.id,
        type: "deposit_updated",
        title: `Opening deposit of ${formatMoney(depositAmount)} recorded`,
        details: [moneyChange(AUDIT_FIELD.depositBalance, 0, depositAmount)],
        performedById,
      });
    }

    if (openingBalance && openingBalance.amount > 0) {
      const bill = await tx.bill.create({
        data: buildOpeningBalanceBill({
          customerId: customer.id,
          cardAssignmentId: assignment.id,
          cardNumber: card.cardNumber,
          amount: openingBalance.amount,
          month: openingBalance.month,
          year: openingBalance.year,
          notes: openingBalance.notes ?? "",
          performedById,
        }),
      });

      audit.add(
        openingBalanceAuditEntry(customer.id, bill, openingBalance.amount, performedById),
      );
    }

    await audit.flush(tx);

    return customer;
  }, TX_OPTIONS);

  return normalizeCustomer(prisma, result);
}

/**
 * The shop is moving onto this system mid-stream, so customers arrive already
 * owing money from months that were only ever recorded on paper.
 *
 * That balance is stored as an ordinary bill flagged `isOpeningBalance`. Doing
 * it this way means payments, carry-forward, statements, ageing and every
 * outstanding total work on it with no special cases — the only thing it lacks
 * is the milk and item lines, because that history does not exist here.
 */
export function buildOpeningBalanceBill(input: {
  customerId: string;
  cardAssignmentId: string;
  cardNumber: number;
  amount: number;
  month: number;
  year: number;
  notes: string;
  performedById: string;
}) {
  const amount = Math.round(input.amount);

  return {
    billNumber: getOpeningBalanceBillNumber(input.month, input.year, input.cardNumber),
    customerId: input.customerId,
    cardAssignmentId: input.cardAssignmentId,
    month: input.month,
    year: input.year,
    billDate: endOfMonth(input.month, input.year),
    dueDate: dueDateFor(input.month, input.year),

    totalMilkLitres: 0,
    milkSummary: [],
    totalItemsCount: 0,
    otherItems: [],
    otherItemsTotal: 0,

    // Recorded as a previous due rather than as current charges: nothing was
    // sold on this bill, it is a balance brought forward from paper records.
    previousDue: amount,
    grandTotal: amount,
    totalPaid: 0,
    outstandingAmount: amount,
    status: "unpaid" as const,

    isOpeningBalance: true,
    notes: input.notes,
    billVersion: 1,
    generatedById: input.performedById,
  };
}

function openingBalanceAuditEntry(
  customerId: string,
  bill: { id: string; billNumber: string; month: number; year: number },
  amount: number,
  performedById: string,
): PendingAuditLog {
  return {
    customerId,
    type: "opening_balance_set",
    title: `Opening outstanding of ${formatMoney(amount)} recorded`,
    details: [
      change(AUDIT_FIELD.billNumber, "", bill.billNumber),
      change(AUDIT_FIELD.billPeriod, "", formatBillPeriod(bill.month, bill.year)),
      moneyChange(AUDIT_FIELD.outstanding, 0, amount),
    ],
    performedById,
    relatedEntityType: "bill",
    relatedEntityId: bill.id,
  };
}

/**
 * An opening balance describes a period that has already finished. Allowing a
 * future month would let it sort ahead of real bills and never be carried
 * forward into them.
 */
export function assertOpeningBalancePeriod(month: number, year: number) {
  const now = new Date();
  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();

  if (year > currentYear || (year === currentYear && month > currentMonth)) {
    throw createHttpError(400, "An opening balance cannot be dated in the future");
  }
}

/**
 * Records the balance a customer was already carrying, for customers that were
 * added before this was captured.
 */
export async function setOpeningBalance(
  app: FastifyInstance,
  customerId: string,
  input: { amount: number; month: number; year: number; notes?: string | undefined },
  performedById: string,
) {
  const prisma = getPrisma(app);

  assertOpeningBalancePeriod(input.month, input.year);

  const [customer, existingOpening, assignment] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId } }),
    prisma.bill.findFirst({ where: { customerId, isOpeningBalance: true } }),
    prisma.cardAssignment.findFirst({
      where: { customerId, unassignedAt: null },
      orderBy: { assignedAt: "desc" },
      include: { card: { select: { cardNumber: true } } },
    }),
  ]);

  if (!customer) throw createHttpError(404, "Customer not found");
  if (customer.status !== "active")
    throw createHttpError(409, "An opening balance can only be set for an active customer");

  if (existingOpening) {
    throw createHttpError(
      409,
      `This customer already has an opening balance (${existingOpening.billNumber}). Remove it first if it needs correcting.`,
    );
  }

  if (!assignment) {
    throw createHttpError(409, "Assign a card to this customer before setting an opening balance");
  }

  // A bill already exists for this period, so an opening balance would either
  // collide on the unique key or silently sit alongside real charges.
  const clashingBill = await prisma.bill.findUnique({
    where: {
      customerId_month_year: { customerId, month: input.month, year: input.year },
    },
    select: { billNumber: true },
  });

  if (clashingBill) {
    throw createHttpError(
      409,
      `A bill already exists for that period (${clashingBill.billNumber}). Choose an earlier month.`,
    );
  }

  return prisma.$transaction(async (tx: PrismaClient) => {
    const bill = await tx.bill.create({
      data: buildOpeningBalanceBill({
        customerId,
        cardAssignmentId: assignment.id,
        cardNumber: assignment.card.cardNumber,
        amount: input.amount,
        month: input.month,
        year: input.year,
        notes: input.notes ?? "",
        performedById,
      }),
    });

    const audit = makeAuditCollector();
    audit.add(openingBalanceAuditEntry(customerId, bill, Math.round(input.amount), performedById));
    await audit.flush(tx);

    return normalizeOpeningBalance(bill);
  }, TX_OPTIONS);
}

/**
 * Removes an opening balance that was entered wrongly.
 *
 * Only possible while it is untouched: once money has been received against it,
 * or its balance has been rolled into a later bill, deleting it would leave
 * those records pointing at nothing.
 */
export async function removeOpeningBalance(
  app: FastifyInstance,
  customerId: string,
  performedById: string,
) {
  const prisma = getPrisma(app);

  const opening = await prisma.bill.findFirst({
    where: { customerId, isOpeningBalance: true },
  });

  if (!opening) throw createHttpError(404, "This customer does not have an opening balance");

  if (opening.status === "carried_forward" || opening.carriedForwardToBillId) {
    throw createHttpError(
      409,
      "This opening balance has already been carried into a later bill and can no longer be removed",
    );
  }

  const paymentCount = await prisma.payment.count({ where: { billId: opening.id } });

  if (paymentCount > 0) {
    throw createHttpError(
      409,
      "Payments have been recorded against this opening balance. Reverse them before removing it.",
    );
  }

  await prisma.$transaction(async (tx: PrismaClient) => {
    await tx.bill.delete({ where: { id: opening.id } });

    const audit = makeAuditCollector();
    audit.add({
      customerId,
      type: "opening_balance_removed",
      title: `Opening outstanding of ${formatMoney(opening.outstandingAmount)} removed`,
      details: [
        change(AUDIT_FIELD.billNumber, opening.billNumber, ""),
        moneyChange(AUDIT_FIELD.outstanding, opening.outstandingAmount, 0),
      ],
      performedById,
    });
    await audit.flush(tx);
  }, TX_OPTIONS);

  return { success: true } as const;
}

export async function getOpeningBalance(app: FastifyInstance, customerId: string) {
  const opening = await getPrisma(app).bill.findFirst({
    where: { customerId, isOpeningBalance: true },
  });

  return opening ? normalizeOpeningBalance(opening) : null;
}

function normalizeOpeningBalance(bill: {
  id: string;
  billNumber: string;
  month: number;
  year: number;
  grandTotal: number;
  totalPaid: number;
  outstandingAmount: number;
  status: string;
  notes: string | null;
  generatedAt: Date;
  carriedForwardToBillId: string | null;
}) {
  return {
    id: bill.id,
    billNumber: bill.billNumber,
    month: bill.month,
    year: bill.year,
    amount: bill.grandTotal,
    totalPaid: bill.totalPaid,
    outstandingAmount: bill.outstandingAmount,
    status: bill.status,
    notes: bill.notes ?? "",
    recordedAt: bill.generatedAt.toISOString(),
    carriedForwardToBillId: bill.carriedForwardToBillId,
  };
}

function formatMilkTypeForAudit(
  milkType: {
    name: string;
    rate: number;
  } | null,
): string {
  if (!milkType) {
    return "";
  }

  return `${milkType.name} (₹${milkType.rate}/L)`;
}

export async function updateCustomer(
  app: FastifyInstance,
  id: string,
  input: UpdateCustomerRequest,
  performedById: string,
): Promise<CustomerResponse> {
  const prisma = getPrisma(app);

  const existing = await prisma.customer.findUnique({
    where: { id },
  });

  if (!existing) throw createHttpError(404, "Customer not found");

  const nextFullName = input.fullName?.trim() ?? existing.fullName;
  // `mobileNumber: ""` is an explicit "clear this field", not "leave unchanged".
  const nextMobileNumber =
    input.mobileNumber === undefined
      ? existing.mobileNumber
      : normalizeMobileNumber(input.mobileNumber);
  const nextAddress = input.address === undefined ? existing.address : input.address.trim();

  if (nextMobileNumber && !/^\d{10}$/.test(nextMobileNumber)) {
    throw createHttpError(400, "Mobile number must be exactly 10 digits");
  }
  const nextDepositAmount = input.depositAmount ?? existing.depositAmount;
  const nextNotes = input.notes ?? existing.notes;

  if (nextDepositAmount !== existing.depositAmount) {
    throw createHttpError(
      400,
      "Use a deposit top-up or refund transaction instead of editing the balance",
    );
  }

  let nextMilkTypes = existing.milkTypes as {
    milkTypeId: string;
    isDefault: boolean;
  }[];

  let milkTypeChanges: {
    field: string;
    oldValue: string;
    newValue: string;
  }[] = [];

  if (input.primaryMilkTypeId || input.otherMilkTypeIds) {
    /**
     * Preserve the existing configuration
     * before replacing it.
     */
    const existingMilkTypes = existing.milkTypes as {
      milkTypeId: string;
      isDefault: boolean;
    }[];

    const existingPrimaryMilkTypeId = existingMilkTypes.find((item) => item.isDefault)?.milkTypeId;

    const existingOtherMilkTypeIds = existingMilkTypes
      .filter((item) => !item.isDefault)
      .map((item) => item.milkTypeId);

    /**
     * Resolve the new configuration.
     */
    const primaryMilkTypeId = input.primaryMilkTypeId ?? existingPrimaryMilkTypeId;

    const otherMilkTypeIds = input.otherMilkTypeIds ?? existingOtherMilkTypeIds;

    if (!primaryMilkTypeId) {
      throw createHttpError(400, "Primary milk type is required");
    }

    /**
     * Primary milk type must always
     * appear first.
     */
    const combined = [
      primaryMilkTypeId,
      ...otherMilkTypeIds.filter((id) => id !== primaryMilkTypeId),
    ];

    /**
     * Prevent duplicate milk types.
     */
    if (new Set(combined).size !== combined.length) {
      throw createHttpError(400, "Milk types cannot contain duplicates");
    }

    /**
     * Load NEW milk type data.
     *
     * We need the rate for the audit log,
     * while the customer document itself
     * continues to store IDs.
     */
    const loaded = await loadMilkTypeMap(
      prisma,
      combined.map((milkTypeId, index) => ({
        milkTypeId,
        isDefault: index === 0,
      })),
    );

    /**
     * Customer document continues to store
     * IDs, not rates.
     */
    nextMilkTypes = loaded.map((item) => ({
      milkTypeId: item.milkTypeId,
      isDefault: item.isDefault,
    }));

    /**
     * NEW milk type rate lookup.
     */
    const newRateMap = new Map(loaded.map((item) => [item.milkTypeId, item.rate]));
    const newNameMap = new Map(loaded.map((item) => [item.milkTypeId, item.milkTypeName]));

    /**
     * Load OLD milk type data so that the
     * audit log can preserve the rate that
     * was configured before this update.
     */
    const existingLoaded = await loadMilkTypeMap(prisma, existingMilkTypes);

    /**
     * OLD milk type rate lookup.
     */
    const oldRateMap = new Map(existingLoaded.map((item) => [item.milkTypeId, item.rate]));
    const oldNameMap = new Map(existingLoaded.map((item) => [item.milkTypeId, item.milkTypeName]));

    /**
     * Resolve primary rates.
     */
    const oldPrimaryRate = existingPrimaryMilkTypeId
      ? oldRateMap.get(existingPrimaryMilkTypeId)
      : undefined;

    const newPrimaryRate = newRateMap.get(primaryMilkTypeId);

    /**
     * Resolve other milk type rates.
     */
    /**
     * Audit using human-meaningful values
     * instead of Mongo/DB IDs.
     */
    milkTypeChanges = collectChanges([
      change(
        AUDIT_FIELD.primaryMilkType,
        describeMilkType(
          existingPrimaryMilkTypeId
            ? {
                name: oldNameMap.get(existingPrimaryMilkTypeId),
                rate: oldPrimaryRate,
              }
            : null,
        ),
        describeMilkType({ name: newNameMap.get(primaryMilkTypeId), rate: newPrimaryRate }),
      ),

      change(
        AUDIT_FIELD.otherMilkTypes,
        describeMilkTypeList(
          existingOtherMilkTypeIds.map((id) => ({
            name: oldNameMap.get(id),
            rate: oldRateMap.get(id),
          })),
        ),
        describeMilkTypeList(
          otherMilkTypeIds.map((id) => ({
            name: newNameMap.get(id),
            rate: newRateMap.get(id),
          })),
        ),
      ),
    ]);
  }

  const transactionResult = await prisma.$transaction(async (tx: PrismaClient) => {
    const updatedCustomer = await tx.customer.update({
      where: { id },
      data: {
        fullName: nextFullName,
        searchName: getSearchName(nextFullName),
        mobileNumber: nextMobileNumber,
        address: nextAddress,
        depositAmount: nextDepositAmount,
        notes: nextNotes,
        milkTypes: nextMilkTypes as any,
        updatedById: performedById,
      } as any,
    });

    const changes = collectChanges([
      change(AUDIT_FIELD.fullName, existing.fullName, nextFullName),
      change(
        AUDIT_FIELD.mobileNumber,
        existing.mobileNumber ?? "Not provided",
        nextMobileNumber ?? "Not provided",
      ),
      change(AUDIT_FIELD.address, existing.address || "Not provided", nextAddress || "Not provided"),
      change(AUDIT_FIELD.notes, existing.notes || "None", nextNotes || "None"),
    ]);

    if (milkTypeChanges.length > 0) {
      await writeAuditLog(tx, {
        customerId: id,
        type: "milk_type_changed",
        title: "Milk type configuration changed",
        details: milkTypeChanges,
        performedById,
      });
    }

    if (changes.length > 0) {
      await writeAuditLog(tx, {
        customerId: id,
        type: "customer_updated",
        title: `Customer updated: ${updatedCustomer.fullName}`,
        details: changes,
        performedById,
      });
    }

    if (input.cardNumber !== undefined) {
      const currentAssignment = await tx.cardAssignment.findFirst({
        where: { customerId: id, unassignedAt: null },
        include: { card: true },
      });

      const targetCard = await resolveCardForCustomer(tx, input.cardNumber);

      if (!currentAssignment || currentAssignment.cardId !== targetCard.id) {
        if (currentAssignment) {
          await tx.cardAssignment.update({
            where: { id: currentAssignment.id },
            data: { unassignedAt: new Date() },
          });

          await tx.card.update({
            where: { id: currentAssignment.cardId },
            data: { status: "available" },
          });

          await writeAuditLog(tx, {
            customerId: id,
            type: "card_unassigned",
            title: `Card ${currentAssignment.card.cardNumber} unassigned`,
            details: [
              change(AUDIT_FIELD.cardNumber, currentAssignment.card.cardNumber, "None"),
            ],
            performedById,
            relatedEntityType: "cardAssignment",
            relatedEntityId: currentAssignment.id,
          });
        }

        const existingCardAssignment = await tx.cardAssignment.findFirst({
          where: { cardId: targetCard.id, unassignedAt: null },
        });

        if (existingCardAssignment && existingCardAssignment.customerId !== id) {
          throw createHttpError(409, "Card is already assigned to another customer");
        }

        const cardAssignment = await tx.cardAssignment.create({
          data: {
            cardId: targetCard.id,
            customerId: id,
            assignedAt: new Date(),
            unassignedAt: null,
            depositAtAssignment: nextDepositAmount,
            assignedById: performedById,
          },
        });

        await tx.card.update({
          where: { id: targetCard.id },
          data: { status: "assigned" },
        });

        await writeAuditLog(tx, {
          customerId: id,
          type: "card_assigned",
          title: `Card ${targetCard.cardNumber} assigned`,
          details: [
            change(
              AUDIT_FIELD.cardNumber,
              currentAssignment?.card.cardNumber ?? "None",
              targetCard.cardNumber,
            ),
          ],
          performedById,
          relatedEntityType: "cardAssignment",
          relatedEntityId: cardAssignment.id,
        });
      }
    }

    return updatedCustomer;
  }, TX_OPTIONS);

  return normalizeCustomer(prisma, transactionResult);
}

export async function archiveCustomer(
  app: FastifyInstance,
  id: string,
  performedById: string,
  refundDeposit = false,
): Promise<CustomerResponse> {
  const prisma = getPrisma(app);
  const existing = await prisma.customer.findUnique({ where: { id } });

  if (!existing) throw createHttpError(404, "Customer not found");
  if (existing.status === "archived") throw createHttpError(409, "Customer is already archived");

  const outstanding = await prisma.bill.aggregate({
    where: { customerId: id },
    _sum: { outstandingAmount: true },
  });
  if (Number(outstanding._sum.outstandingAmount ?? 0) > 0) {
    throw createHttpError(409, "Clear all outstanding bills before closing this customer");
  }
  if (existing.depositAmount > 0 && !refundDeposit) {
    throw createHttpError(409, "Refund the remaining deposit before closing this customer");
  }

  const result = await prisma.$transaction(async (tx: PrismaClient) => {
    const now = new Date();

    const activeAssignment = await tx.cardAssignment.findFirst({
      where: { customerId: id, unassignedAt: null },
      include: { card: true },
    });

    if (activeAssignment) {
      await tx.cardAssignment.update({
        where: { id: activeAssignment.id },
        data: { unassignedAt: now },
      });

      await tx.card.update({
        where: { id: activeAssignment.cardId },
        data: { status: "available" },
      });

      await writeAuditLog(tx, {
        customerId: id,
        type: "card_unassigned",
        title: `Card ${activeAssignment.card.cardNumber} unassigned`,
        details: [change(AUDIT_FIELD.cardNumber, activeAssignment.card.cardNumber, "None")],
        performedById,
        relatedEntityType: "cardAssignment",
        relatedEntityId: activeAssignment.id,
      });
    }

    const updated = await tx.customer.update({
      where: { id },
      data: {
        status: "archived",
        archivedAt: now,
        depositAmount: refundDeposit ? 0 : existing.depositAmount,
        updatedById: performedById,
      },
    });

    await writeAuditLog(tx, {
      customerId: id,
      type: "customer_closed",
      title: `Customer closed: ${updated.fullName}`,
      details: [change(AUDIT_FIELD.status, "Active", "Closed")],
      performedById,
    });

    if (refundDeposit && existing.depositAmount > 0) {
      await tx.depositTransaction.create({
        data: {
          customerId: id,
          type: "refund",
          amount: -existing.depositAmount,
          balanceAfter: 0,
          reference: "Customer closure refund",
          performedById,
        },
      });
      await writeAuditLog(tx, {
        customerId: id,
        type: "deposit_updated",
        title: `Deposit of ${formatMoney(existing.depositAmount)} refunded on closure`,
        details: [moneyChange(AUDIT_FIELD.depositBalance, existing.depositAmount, 0)],
        performedById,
      });
    }

    return updated;
  }, TX_OPTIONS);

  return normalizeCustomer(prisma, result);
}

export async function topUpDeposit(
  app: FastifyInstance,
  id: string,
  input: { amount: number; notes?: string | undefined },
  performedById: string,
) {
  const prisma = getPrisma(app);

  return prisma.$transaction(async (tx: PrismaClient) => {
    const customer = await tx.customer.findUnique({ where: { id } });

    if (!customer || customer.status !== "active")
      throw createHttpError(404, "Active customer not found");

    const balanceAfter = Math.round(Number(customer.depositAmount) + input.amount);

    await tx.customer.update({
      where: { id },
      data: { depositAmount: balanceAfter, updatedById: performedById },
    });

    const transaction = await tx.depositTransaction.create({
      data: {
        customerId: id,
        type: "top_up",
        amount: input.amount,
        balanceAfter,
        notes: input.notes ?? "",
        performedById,
      },
    });
    await writeAuditLog(tx, {
      customerId: id,
      type: "deposit_updated",
      title: `Deposit topped up by ${formatMoney(input.amount)}`,
      details: collectChanges([
        moneyChange(AUDIT_FIELD.depositChange, 0, input.amount),
        moneyChange(AUDIT_FIELD.depositBalance, customer.depositAmount, balanceAfter),
        change(AUDIT_FIELD.notes, "", input.notes ?? ""),
      ]),
      performedById,
      relatedEntityType: "payment",
      relatedEntityId: transaction.id,
    });
    return transaction;
  }, TX_OPTIONS);
}

export async function refundDeposit(
  app: FastifyInstance,
  id: string,
  input: { amount: number; notes?: string | undefined },
  performedById: string,
) {
  const prisma = getPrisma(app);
  return prisma.$transaction(async (tx: PrismaClient) => {
    const customer = await tx.customer.findUnique({ where: { id } });
    if (!customer) throw createHttpError(404, "Customer not found");
    if (input.amount > Number(customer.depositAmount))
      throw createHttpError(400, "Refund cannot exceed the available deposit");
    const balanceAfter = Math.round(Number(customer.depositAmount) - input.amount);
    await tx.customer.update({
      where: { id },
      data: { depositAmount: balanceAfter, updatedById: performedById },
    });
    const transaction = await tx.depositTransaction.create({
      data: {
        customerId: id,
        type: "refund",
        amount: -input.amount,
        balanceAfter,
        notes: input.notes ?? "",
        performedById,
      },
    });
    await writeAuditLog(tx, {
      customerId: id,
      type: "deposit_updated",
      title: `Deposit refunded: ${formatMoney(input.amount)}`,
      details: collectChanges([
        moneyChange(AUDIT_FIELD.depositChange, input.amount, 0),
        moneyChange(AUDIT_FIELD.depositBalance, customer.depositAmount, balanceAfter),
        change(AUDIT_FIELD.notes, "", input.notes ?? ""),
      ]),
      performedById,
      relatedEntityType: "payment",
      relatedEntityId: transaction.id,
    });
    return transaction;
  }, TX_OPTIONS);
}

export async function getCustomerStatement(app: FastifyInstance, id: string) {
  const prisma = getPrisma(app);
  const customer = await prisma.customer.findUnique({ where: { id } });

  if (!customer) throw createHttpError(404, "Customer not found");

  const [bills, payments, deposits] = await Promise.all([
    prisma.bill.findMany({ where: { customerId: id }, orderBy: { billDate: "asc" } }),
    prisma.payment.findMany({
      where: { customerId: id, reversedAt: null },
      orderBy: { receivedAt: "asc" },
    }),
    prisma.depositTransaction.findMany({
      // `bill_applied` movements are already represented by the payment's
      // `depositUsed`. Including them here credited the same rupees twice and
      // made the running balance drift away from the bills.
      where: { customerId: id, type: { not: "bill_applied" } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const entries = [
    ...bills.map((bill: { billDate: Date; billNumber: string; grandTotal: number }) => ({
      date: bill.billDate,
      type: "bill",
      reference: bill.billNumber,
      debit: bill.grandTotal,
      credit: 0,
    })),
    ...payments.map(
      (payment: {
        receivedAt: Date;
        receiptNumber: string;
        amount: number;
        depositUsed: number;
      }) => ({
        date: payment.receivedAt,
        type: "payment",
        reference: payment.receiptNumber,
        debit: 0,
        credit: payment.amount + payment.depositUsed,
      }),
    ),
    ...deposits.map(
      (deposit: {
        createdAt: Date;
        type: string;
        reference: string;
        amount: number;
        balanceAfter: number;
      }) => ({
        date: deposit.createdAt,
        type: `deposit_${deposit.type}`,
        reference: deposit.reference,
        debit: 0,
        credit: deposit.amount,
        depositAmount: deposit.amount,
        depositBalance: deposit.balanceAfter,
      }),
    ),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
  let balance = 0;
  return {
    customerId: id,
    depositBalance: customer.depositAmount,
    items: entries.map((entry) => ({
      ...entry,
      date: entry.date.toISOString(),
      balance: (balance = Math.round(balance + entry.debit - entry.credit)),
    })),
  };
}

export async function restoreCustomer(
  app: FastifyInstance,
  id: string,
  performedById: string,
): Promise<CustomerResponse> {
  const prisma = getPrisma(app);
  const existing = await prisma.customer.findUnique({ where: { id } });

  if (!existing) throw createHttpError(404, "Customer not found");
  if (existing.status === "active") throw createHttpError(409, "Customer is already active");

  const result = await prisma.$transaction(async (tx: PrismaClient) => {
    const updated = await tx.customer.update({
      where: { id },
      data: {
        status: "active",
        archivedAt: null,
        updatedById: performedById,
      },
    });

    await writeAuditLog(tx, {
      customerId: id,
      type: "customer_reopened",
      title: `Customer restored: ${updated.fullName}`,
      details: [change(AUDIT_FIELD.status, "Closed", "Active")],
      performedById,
    });

    return updated;
  }, TX_OPTIONS);

  return normalizeCustomer(prisma, result);
}

export async function getCustomerCardAssignment(
  app: FastifyInstance,
  customerId: string,
): Promise<CardAssignmentSummaryResponse> {
  const prisma = getPrisma(app);

  const assignment = await prisma.cardAssignment.findFirst({
    where: {
      customerId,
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

export async function getCustomerCardHistory(
  app: FastifyInstance,
  id: string,
): Promise<{ items: CustomerCardAssignmentResponse[] }> {
  const prisma = getPrisma(app);

  const items = await prisma.cardAssignment.findMany({
    where: { customerId: id },
    orderBy: { assignedAt: "desc" },
    include: { customer: true, assignedBy: true, card: true },
  });

  return {
    items: items.map((assignment: CardAssignmentWithRelations) => ({
      id: assignment.id,
      cardId: assignment.cardId,
      customerId: assignment.customerId,
      assignedAt: assignment.assignedAt.toISOString(),
      unassignedAt: toIso(assignment.unassignedAt),
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
    })),
  };
}

export async function getCustomerBills(
  app: FastifyInstance,
  id: string,
  query: CustomerBillsQuery,
): Promise<CustomerBillListResponse> {
  const prisma = getPrisma(app);
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const search = query.search?.trim();

  const where: Prisma.BillWhereInput = { customerId: id };
  if (query.month !== undefined) where.month = query.month;
  if (query.year !== undefined) where.year = query.year;
  if (query.status !== undefined) where.status = query.status;

  if (search) {
    const searchMatches: Prisma.BillWhereInput[] = [
      { billNumber: { contains: search, mode: "insensitive" } },
    ];

    const numericSearch = Number(search);
    if (Number.isInteger(numericSearch) && numericSearch >= 0) {
      searchMatches.push({ month: numericSearch });
      searchMatches.push({ year: numericSearch });
    }

    where.OR = searchMatches;
  }

  const [totalItems, summary] = await Promise.all([
    prisma.bill.count({ where }),
    prisma.bill.aggregate({
      where,
      _count: { _all: true },
      _sum: {
        grandTotal: true,
        totalPaid: true,
        outstandingAmount: true,
      },
    }),
  ]);

  const safePage = totalItems === 0 ? 1 : Math.min(page, Math.ceil(totalItems / limit));
  const skip = (safePage - 1) * limit;

  const bills: CustomerBillRecord[] = await prisma.bill.findMany({
    where,
    orderBy: [{ year: "desc" }, { month: "desc" }, { generatedAt: "desc" }],
    skip,
    take: limit,
    include: {
      customer: {
        select: {
          id: true,
          fullName: true,
          mobileNumber: true,
        },
      },
      cardAssignment: {
        select: {
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
        },
      },
      generatedBy: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  });

  const items: CustomerBillListItem[] = bills.map((bill): CustomerBillListItem => ({
    id: bill.id,
    billNumber: bill.billNumber,
    customerId: bill.customerId,
    customer: {
      id: bill.customer.id,
      fullName: bill.customer.fullName,
      mobileNumber: bill.customer.mobileNumber ?? "",
    },
    cardAssignment: {
      id: bill.cardAssignment.id,
      cardId: bill.cardAssignment.cardId,
      cardNumber: bill.cardAssignment.card?.cardNumber ?? null,
      assignedAt: bill.cardAssignment.assignedAt.toISOString(),
      unassignedAt: bill.cardAssignment.unassignedAt
        ? bill.cardAssignment.unassignedAt.toISOString()
        : null,
      depositAtAssignment: bill.cardAssignment.depositAtAssignment ?? 0,
    },
    month: bill.month,
    year: bill.year,
    billDate: bill.billDate.toISOString(),
    totalMilkLitres: bill.totalMilkLitres ?? 0,
    totalItemsCount: bill.totalItemsCount ?? 0,
    otherItemsTotal: bill.otherItemsTotal ?? 0,
    previousDue: bill.previousDue ?? 0,
    grandTotal: bill.grandTotal ?? 0,
    totalPaid: bill.totalPaid ?? 0,
    outstandingAmount: bill.outstandingAmount ?? 0,
    status: bill.status,
    billVersion: bill.billVersion ?? 1,
    generatedAt: bill.generatedAt.toISOString(),
    carriedForward:
      bill.carriedForwardToBillId && bill.carriedForwardAmount > 0
        ? { amount: bill.carriedForwardAmount, toBillId: bill.carriedForwardToBillId }
        : null,
    isOpeningBalance: bill.isOpeningBalance ?? false,
  }));

  return {
    items,
    pageInfo: buildPageInfo(totalItems, safePage, limit),
    summary: {
      totalBills: summary._count._all,
      totalBilled: summary._sum.grandTotal ?? 0,
      totalPaid: summary._sum.totalPaid ?? 0,
      outstanding: summary._sum.outstandingAmount ?? 0,
    },
  };
}

export async function getCustomerPayments(
  app: FastifyInstance,
  id: string,
  query: {
    page?: number | undefined;
    limit?: number | undefined;
    billId?: string | undefined;
    billMonth?: number | undefined;
    billYear?: number | undefined;
    paymentMethod?: PaymentMethod | undefined;
    search?: string | undefined;
  },
): Promise<CustomerPaymentListResponse> {
  const prisma = getPrisma(app);
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const search = query.search?.trim();

  const where: Prisma.PaymentWhereInput = { customerId: id };
  if (query.billId) where.billId = query.billId;
  if (query.billMonth !== undefined) where.billMonth = query.billMonth;
  if (query.billYear !== undefined) where.billYear = query.billYear;
  if (query.paymentMethod !== undefined) where.paymentMethod = query.paymentMethod;

  if (search) {
    const searchMatches: Prisma.PaymentWhereInput[] = [
      { receiptNumber: { contains: search, mode: "insensitive" } },
      { referenceNumber: { contains: search, mode: "insensitive" } },
      {
        bill: {
          billNumber: { contains: search, mode: "insensitive" },
        },
      },
    ];

    where.OR = searchMatches;
  }

  // Reversed receipts stay in the list (staff need to see them) but must not
  // be counted as money received.
  const activeWhere: Prisma.PaymentWhereInput = { ...where, reversedAt: null };

  const [totalItems, paymentAggregate, billAggregate, outstandingBillCount, nextOutstandingBill] =
    await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.aggregate({
        where: activeWhere,
        _count: { _all: true },
        _sum: {
          amount: true,
          depositUsed: true,
        },
        _max: {
          receivedAt: true,
        },
      }),
      prisma.bill.aggregate({
        where: { customerId: id },
        _sum: {
          grandTotal: true,
          outstandingAmount: true,
        },
      }),
      prisma.bill.count({
        where: {
          customerId: id,
          outstandingAmount: { gt: 0 },
        },
      }),
      prisma.bill.findFirst({
        where: {
          customerId: id,
          outstandingAmount: { gt: 0 },
        },
        orderBy: [{ year: "desc" }, { month: "desc" }, { generatedAt: "desc" }],
        select: {
          id: true,
          billNumber: true,
          month: true,
          year: true,
          outstandingAmount: true,
        },
      }),
    ]);

  const safePage = totalItems === 0 ? 1 : Math.min(page, Math.ceil(totalItems / limit));
  const skip = (safePage - 1) * limit;

  const payments = await prisma.payment.findMany({
    where,
    orderBy: { receivedAt: "desc" },
    skip,
    take: limit,
    include: {
      customer: {
        select: {
          id: true,
          fullName: true,
          mobileNumber: true,
        },
      },
      bill: {
        select: {
          id: true,
          billNumber: true,
          month: true,
          year: true,
          status: true,
          outstandingAmount: true,
        },
      },
      receivedBy: {
        select: {
          id: true,
          fullName: true,
        },
      },
      editedBy: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  });

  type CustomerPaymentItem = CustomerPaymentListResponse["items"][number];

  const items: CustomerPaymentItem[] = payments.map(
    (payment: CustomerPaymentRecord): CustomerPaymentItem => ({
      id: payment.id,
      customerId: payment.customerId,
      customer: {
        id: payment.customer.id,
        fullName: payment.customer.fullName,
        mobileNumber: payment.customer.mobileNumber ?? "",
      },
      billId: payment.billId,
      bill: {
        id: payment.bill.id,
        billNumber: payment.bill.billNumber,
        month: payment.bill.month,
        year: payment.bill.year,
        status: payment.bill.status,
        outstandingAmount: payment.bill.outstandingAmount ?? 0,
      },
      billMonth: payment.billMonth,
      billYear: payment.billYear,
      receiptNumber: payment.receiptNumber ?? "",
      amount: payment.amount,
      depositUsed: payment.depositUsed ?? 0,
      creditedAmount: (payment.amount ?? 0) + (payment.depositUsed ?? 0),
      paymentMethod: payment.paymentMethod,
      referenceNumber: payment.referenceNumber ?? "",
      notes: payment.notes ?? "",
      receivedAt: payment.receivedAt.toISOString(),
      receivedBy: {
        id: payment.receivedBy.id,
        fullName: payment.receivedBy.fullName,
      },
      editedAt: payment.editedAt ? payment.editedAt.toISOString() : null,
      editedBy: payment.editedBy
        ? {
            id: payment.editedBy.id,
            fullName: payment.editedBy.fullName,
          }
        : null,
    }),
  );

  return {
    items,
    pageInfo: buildPageInfo(totalItems, safePage, limit),
    summary: {
      totalPayments: paymentAggregate._count._all,
      totalPaid: (paymentAggregate._sum.amount ?? 0) + (paymentAggregate._sum.depositUsed ?? 0),
      totalBilled: billAggregate._sum.grandTotal ?? 0,
      outstanding: billAggregate._sum.outstandingAmount ?? 0,
      lastPaymentAt: paymentAggregate._max.receivedAt
        ? paymentAggregate._max.receivedAt.toISOString()
        : null,
      outstandingBillCount,
    },
    nextOutstandingBill: nextOutstandingBill
      ? {
          id: nextOutstandingBill.id,
          billNumber: nextOutstandingBill.billNumber,
          month: nextOutstandingBill.month,
          year: nextOutstandingBill.year,
          outstandingAmount: nextOutstandingBill.outstandingAmount,
        }
      : null,
  };
}

export async function getCustomerAuditLogs(
  app: FastifyInstance,
  id: string,
  query: {
    page?: number;
    limit?: number;
    types?: string[];
  },
): Promise<CustomerAuditLogResponse> {
  const prisma = getPrisma(app);
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Prisma.AuditLogWhereInput = { customerId: id };

  if (query.types?.length) {
    where.type = { in: query.types as any };
  }

  const [totalItems, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { performedAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        details: true,
        performedAt: true,
        relatedEntityType: true,
        relatedEntityId: true,
        performedBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    }),
  ]);

  const safePage = totalItems === 0 ? 1 : Math.min(page, Math.ceil(totalItems / limit));

  const items: CustomerAuditLogItemResponse[] = logs.map(
    (log: CustomerAuditLogRecord): CustomerAuditLogItemResponse => ({
      id: log.id,
      type: log.type,
      title: log.title,
      details: (log.details ?? []).map(
        (item: CustomerAuditLogDetail): CustomerAuditLogDetailResponse => ({
          field: item.field,
          oldValue: String(item.oldValue ?? ""),
          newValue: String(item.newValue ?? ""),
        }),
      ),
      performedBy: {
        id: log.performedBy.id,
        fullName: log.performedBy.fullName,
      },
      performedAt: log.performedAt.toISOString(),
      relatedEntityType: log.relatedEntityType ?? null,
      relatedEntityId: log.relatedEntityId ?? null,
    }),
  );

  return {
    items,
    pageInfo: buildPageInfo(totalItems, safePage, limit),
  };
}

export async function getCustomerDailyHistory(
  app: FastifyInstance,
  id: string,
  query: { month?: number | undefined; year?: number | undefined },
): Promise<CustomerDailyHistoryResponse> {
  const prisma = getPrisma(app);
  const month = query.month ?? new Date().getMonth() + 1;
  const year = query.year ?? new Date().getFullYear();

  const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const startOfNextMonth = new Date(Date.UTC(year, month, 1));

  const ledgers = await prisma.dailyLedger.findMany({
    where: {
      customerId: id,
      ledgerDate: {
        gte: startOfMonth,
        lt: startOfNextMonth,
      },
    },
    orderBy: { ledgerDate: "asc" },
  });

  const items: CustomerDailyHistoryItemResponse[] = ledgers.map((ledger: DailyLedgerRecord) => ({
    id: ledger.id,
    ledgerDate: ledger.ledgerDate.toISOString(),
    entries: ledger.entries as unknown[],
    createdAt: ledger.createdAt.toISOString(),
    updatedAt: ledger.updatedAt.toISOString(),
  }));

  return {
    items,
    pageInfo: buildPageInfo(items.length, 1, items.length || 1),
  };
}
