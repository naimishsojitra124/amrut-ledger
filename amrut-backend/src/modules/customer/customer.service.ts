import type { FastifyInstance } from "fastify";
import type { PaymentMethod, Prisma, PrismaClient } from "../../../generated/prisma/client";
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

type CustomerWithCardAssignments = Prisma.CustomerGetPayload<{
  include: {
    cardAssignments: {
      where: { unassignedAt: null };
      take: 1;
      include: {
        card: true;
      };
    };
  };
}>;

type CardAssignmentWithRelations = Prisma.CardAssignmentGetPayload<{
  include: {
    customer: true;
    assignedBy: true;
    card: true;
  };
}>;

type BillWithRelations = Prisma.BillGetPayload<{
  include: {
    customer: true;
    cardAssignment: {
      include: {
        card: true;
      };
    };
    generatedBy: true;
  };
}>;

type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: {
    customer: true;
    bill: true;
    receivedBy: true;
    editedBy: true;
  };
}>;

type AuditLogWithRelations = Prisma.AuditLogGetPayload<{
  include: {
    performedBy: true;
  };
}>;

type DailyLedgerRecord = Prisma.DailyLedgerGetPayload<{}>;

function createHttpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}

function getPrisma(app: FastifyInstance) {
  return (app as FastifyInstance & { prisma: PrismaClient }).prisma;
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

async function loadCustomerCurrentCard(prisma: PrismaClient, customerId: string) {
  const assignment = await prisma.cardAssignment.findFirst({
    where: { customerId, unassignedAt: null },
    orderBy: { assignedAt: "desc" },
    include: { card: true },
  });

  return assignment ? normalizeCardAssignment(assignment) : null;
}

async function loadCustomerMilkTypes(prisma: PrismaClient, customer: any) {
  const embedded = (customer.milkTypes ?? []) as { milkTypeId: string; isDefault: boolean }[];
  const ids = [...new Set(embedded.map((item) => item.milkTypeId))];

  if (ids.length === 0) return [];

  const dbMilkTypes = await prisma.milkType.findMany({
    where: { id: { in: ids } },
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
    mobileNumber: customer.mobileNumber,
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

function serializeChange(field: string, oldValue: unknown, newValue: unknown) {
  return {
    field,
    oldValue: String(oldValue ?? ""),
    newValue: String(newValue ?? ""),
  };
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
    details: [
      serializeChange("cardId", activeAssignment.cardId, ""),
      serializeChange("cardNumber", activeAssignment.card.cardNumber, ""),
    ],
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
      title: `Card ${activeAssignmentForCustomer.cardId} unassigned`,
      details: [],
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
    details: [
      serializeChange("cardId", "", card.id),
      serializeChange("cardNumber", "", card.cardNumber),
    ],
    performedById: assignedById,
    relatedEntityType: "cardAssignment",
    relatedEntityId: assignment.id,
  });

  return { card, assignmentId: assignment.id };
}

async function fetchCustomerBaseList(prisma: PrismaClient, query: CustomerListQuery) {
  const where: any = {};

  if (query.status) where.status = query.status;
  if (query.search) {
    const s = query.search.trim();
    where.OR = [
      { fullName: { contains: s, mode: "insensitive" } },
      { mobileNumber: { contains: s } },
      { searchName: { contains: s, mode: "insensitive" } },
    ];
  }

  const customers = await prisma.customer.findMany({
    where,
    orderBy: [{ createdAt: "asc" }],
  });

  const customerIds = customers.map((customer) => customer.id);

  const [outstandingByCustomer, lastEntryByCustomer] = await Promise.all([
    loadCustomerOutstandingMap(prisma, customerIds),
    loadCustomerLastEntryMap(prisma, customerIds),
  ]);

  let normalized = await Promise.all(
    customers.map(async (customer) => {
      const base = await normalizeCustomer(prisma, customer);

      return {
        ...base,
        outstandingAmount: outstandingByCustomer.get(customer.id) ?? 0,
        lastEntryAt: lastEntryByCustomer.get(customer.id) ?? null,
      };
    }),
  );

  if (query.search) {
    const s = query.search.trim().toLowerCase();
    normalized = normalized.filter((customer) => {
      const cardNumber = customer.currentCard?.cardNumber?.toString() ?? "";
      return (
        customer.fullName.toLowerCase().includes(s) ||
        customer.mobileNumber.includes(s) ||
        customer.searchName.toLowerCase().includes(s) ||
        cardNumber.includes(s)
      );
    });
  }

  return normalized;
}

export async function getCustomers(
  app: FastifyInstance,
  query: CustomerListQuery,
): Promise<CustomerListResponse> {
  const prisma = getPrisma(app);
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;

  const all = await fetchCustomerBaseList(prisma, query);
  const totalItems = all.length;
  const pageInfo = buildPageInfo(totalItems, page, limit);
  const start = (pageInfo.page - 1) * limit;

  return {
    items: all.slice(start, start + limit),
    pageInfo,
  };
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

  const customers = await prisma.customer.findMany({
    include: {
      cardAssignments: {
        where: { unassignedAt: null },
        take: 1,
      },
    },
  });

  const customersWithCard = customers.filter(
    (customer: CustomerWithCardAssignments) => customer.cardAssignments.length > 0,
  ).length;

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

export async function createCustomer(
  app: FastifyInstance,
  input: CreateCustomerRequest,
  performedById: string,
): Promise<CustomerResponse> {
  const prisma = getPrisma(app);

  const duplicateMobile = await prisma.customer.findUnique({
    where: { mobileNumber: input.mobileNumber },
  });

  if (duplicateMobile) {
    throw createHttpError(409, "Mobile number already exists");
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

  const milkTypes = await loadMilkTypeMap(prisma, milkTypesInput);

  const createdAt = new Date();
  const depositAmount = input.depositAmount ?? 0;
  const notes = input.notes ?? "";

  const result = await prisma.$transaction(async (tx: PrismaClient) => {
    const customer = await tx.customer.create({
      data: {
        fullName: input.fullName.trim(),
        searchName: getSearchName(input.fullName),
        mobileNumber: input.mobileNumber.trim(),
        address: input.address.trim(),
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

    await writeAuditLog(tx, {
      customerId: customer.id,
      type: "customer_created",
      title: `Customer created: ${customer.fullName}`,
      details: [
        serializeChange("fullName", "", customer.fullName),
        serializeChange("mobileNumber", "", customer.mobileNumber),
        serializeChange("depositAmount", "", depositAmount),
      ],
      performedById,
    });

    if (depositAmount > 0) {
      await tx.depositTransaction.create({
        data: {
          customerId: customer.id,
          type: "top_up",
          amount: depositAmount,
          balanceAfter: depositAmount,
          reference: "Customer opening deposit",
          performedById,
        },
      });
      await writeAuditLog(tx, {
        customerId: customer.id,
        type: "deposit_updated",
        title: "Deposit initialized",
        details: [serializeChange("depositAmount", "", depositAmount)],
        performedById,
      });
    }

    const cardResult = await assignCardToCustomer(
      tx,
      customer.id,
      input.cardNumber,
      performedById,
      createdAt,
      depositAmount,
    );

    if (cardResult.card) {
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          depositAmount,
        },
      });
    }

    return customer;
  });

  return normalizeCustomer(prisma, result);
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
  const nextMobileNumber = input.mobileNumber?.trim() ?? existing.mobileNumber;
  const nextAddress = input.address?.trim() ?? existing.address;
  const nextDepositAmount = input.depositAmount ?? existing.depositAmount;
  const nextNotes = input.notes ?? existing.notes;

  if (nextDepositAmount !== existing.depositAmount) {
    throw createHttpError(
      400,
      "Use a deposit top-up or refund transaction instead of editing the balance",
    );
  }

  if (nextMobileNumber !== existing.mobileNumber) {
    const duplicate = await prisma.customer.findUnique({
      where: { mobileNumber: nextMobileNumber },
    });

    if (duplicate && duplicate.id !== id) {
      throw createHttpError(409, "Mobile number already exists");
    }
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
    const oldOtherRates = existingOtherMilkTypeIds.map((id) => oldRateMap.get(id));

    const newOtherRates = otherMilkTypeIds.map((id) => newRateMap.get(id));

    /**
     * Audit using human-meaningful values
     * instead of Mongo/DB IDs.
     */
    milkTypeChanges = [
      serializeChange("primaryMilkTypeRate", oldPrimaryRate ?? "", newPrimaryRate ?? ""),

      serializeChange(
        "otherMilkTypeRates",
        JSON.stringify(oldOtherRates),
        JSON.stringify(newOtherRates),
      ),
    ];
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

    const changes: { field: string; oldValue: string; newValue: string }[] = [];

    if (nextFullName !== existing.fullName)
      changes.push(serializeChange("fullName", existing.fullName, nextFullName));
    if (nextMobileNumber !== existing.mobileNumber)
      changes.push(serializeChange("mobileNumber", existing.mobileNumber, nextMobileNumber));
    if (nextAddress !== existing.address)
      changes.push(serializeChange("address", existing.address, nextAddress));
    if (nextNotes !== existing.notes)
      changes.push(serializeChange("notes", existing.notes, nextNotes));

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
            details: [serializeChange("cardNumber", currentAssignment.card.cardNumber, "")],
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
          details: [serializeChange("cardNumber", "", targetCard.cardNumber)],
          performedById,
          relatedEntityType: "cardAssignment",
          relatedEntityId: cardAssignment.id,
        });
      }
    }

    return updatedCustomer;
  });

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
        details: [serializeChange("cardNumber", activeAssignment.card.cardNumber, "")],
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
      title: `Customer archived: ${updated.fullName}`,
      details: [serializeChange("status", "active", "archived")],
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
        title: "Deposit refunded on customer closure",
        details: [serializeChange("depositAmount", existing.depositAmount, 0)],
        performedById,
      });
    }

    return updated;
  });

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

    const balanceAfter = Number(customer.depositAmount) + input.amount;

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
      title: "Deposit topped up",
      details: [serializeChange("depositAmount", customer.depositAmount, balanceAfter)],
      performedById,
      relatedEntityType: "payment",
      relatedEntityId: transaction.id,
    });
    return transaction;
  });
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
    const balanceAfter = Number(customer.depositAmount) - input.amount;
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
      title: "Deposit refunded",
      details: [serializeChange("depositAmount", customer.depositAmount, balanceAfter)],
      performedById,
      relatedEntityType: "payment",
      relatedEntityId: transaction.id,
    });
    return transaction;
  });
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
      where: { customerId: id },
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
      balance: (balance = Math.round((balance + entry.debit - entry.credit) * 100) / 100),
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
      details: [serializeChange("status", "archived", "active")],
      performedById,
    });

    return updated;
  });

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
  query: {
    page?: number;
    limit?: number;
    month?: number;
    year?: number;
    status?: any;
    search?: string | undefined;
  },
): Promise<CustomerBillListResponse> {
  const prisma = getPrisma(app);
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const where: any = { customerId: id };
  if (query.month !== undefined) where.month = query.month;
  if (query.year !== undefined) where.year = query.year;
  if (query.status !== undefined) where.status = query.status;

  const bills = await prisma.bill.findMany({
    where,
    orderBy: [{ year: "desc" }, { month: "desc" }, { generatedAt: "desc" }],
    include: {
      customer: true,
      cardAssignment: { include: { card: true } },
      generatedBy: true,
    },
  });

  let items = bills.map((bill: BillWithRelations) => ({
    id: bill.id,
    billNumber: bill.billNumber,
    customerId: bill.customerId,
    customer: {
      id: bill.customer.id,
      fullName: bill.customer.fullName,
      mobileNumber: bill.customer.mobileNumber,
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
  }));

  if (query.search) {
    const s = query.search.trim().toLowerCase();
    items = items.filter(
      (bill: BillWithRelations) =>
        bill.billNumber.toLowerCase().includes(s) ||
        bill.month.toString().includes(s) ||
        bill.year.toString().includes(s),
    );
  }

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const safePage = Math.min(page, totalPages);

  return {
    items: items.slice((safePage - 1) * limit, (safePage - 1) * limit + limit),
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

export async function getCustomerPayments(
  app: FastifyInstance,
  id: string,
  query: {
    page?: number;
    limit?: number;
    billId?: string;
    billMonth?: number;
    billYear?: number;
    paymentMethod?: PaymentMethod;
    search?: string | undefined;
  },
): Promise<CustomerPaymentListResponse> {
  const prisma = getPrisma(app);
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const where: any = { customerId: id };
  if (query.billId) where.billId = query.billId;
  if (query.billMonth !== undefined) where.billMonth = query.billMonth;
  if (query.billYear !== undefined) where.billYear = query.billYear;
  if (query.paymentMethod !== undefined) where.paymentMethod = query.paymentMethod;

  const payments = await prisma.payment.findMany({
    where,
    orderBy: { receivedAt: "desc" },
    include: {
      customer: true,
      bill: true,
      receivedBy: true,
      editedBy: true,
    },
  });

  let items = payments.map((payment: PaymentWithRelations) => ({
    id: payment.id,
    customerId: payment.customerId,
    customer: {
      id: payment.customer.id,
      fullName: payment.customer.fullName,
      mobileNumber: payment.customer.mobileNumber,
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
    receiptNumber: payment.receiptNumber,
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
  }));

  if (query.search) {
    const s = query.search.trim().toLowerCase();
    items = items.filter(
      (payment: PaymentWithRelations) =>
        payment.receiptNumber.toLowerCase().includes(s) ||
        payment.referenceNumber.toLowerCase().includes(s) ||
        payment.bill.billNumber.toLowerCase().includes(s),
    );
  }

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const safePage = Math.min(page, totalPages);

  return {
    items: items.slice((safePage - 1) * limit, (safePage - 1) * limit + limit),
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

export async function getCustomerAuditLogs(
  app: FastifyInstance,
  id: string,
  query: { page?: number; limit?: number },
): Promise<CustomerAuditLogResponse> {
  const prisma = getPrisma(app);
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const logs = await prisma.auditLog.findMany({
    where: { customerId: id },
    orderBy: { performedAt: "desc" },
    include: { performedBy: true },
  });

  const items: CustomerAuditLogItemResponse[] = logs.map((log: AuditLogWithRelations) => ({
    id: log.id,
    type: log.type,
    title: log.title,
    details: (log.details ?? []).map((item: any) => ({
      field: item.field,
      oldValue: item.oldValue,
      newValue: item.newValue,
    })),
    performedBy: {
      id: log.performedBy.id,
      fullName: log.performedBy.fullName,
    },
    performedAt: log.performedAt.toISOString(),
    relatedEntityType: log.relatedEntityType ?? null,
    relatedEntityId: log.relatedEntityId ?? null,
  }));

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const safePage = Math.min(page, totalPages);

  return {
    items: items.slice((safePage - 1) * limit, (safePage - 1) * limit + limit),
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

export async function getCustomerDailyHistory(
  app: FastifyInstance,
  id: string,
  query: { month?: number | undefined; year?: number | undefined },
): Promise<CustomerDailyHistoryResponse> {
  const prisma = getPrisma(app);
  const month = query.month ?? new Date().getMonth() + 1;
  const year = query.year ?? new Date().getFullYear();

  const ledgers = await prisma.dailyLedger.findMany({
    where: { customerId: id },
    orderBy: { ledgerDate: "desc" },
  });

  const items: CustomerDailyHistoryItemResponse[] = ledgers.map((ledger: DailyLedgerRecord) => ({
    id: ledger.id,
    ledgerDate: ledger.ledgerDate.toISOString(),
    entries: ledger.entries as unknown[],
    createdAt: ledger.createdAt.toISOString(),
    updatedAt: ledger.updatedAt.toISOString(),
  }));

  // filter by month/year
  const filtered = items.filter((it) => {
    const d = new Date(it.ledgerDate);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });

  const totalItems = filtered.length;
  const pageInfo = buildPageInfo(totalItems, 1, totalItems || 1);

  return {
    items: filtered,
    pageInfo,
  };
}
