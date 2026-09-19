import type { FastifyInstance } from "fastify";
import type { Prisma, PrismaClient } from "../../../generated/prisma/client";
import type { BillStatus, PaymentMethod } from "../../../generated/prisma/enums";
import {
  AUDIT_FIELD,
  change,
  formatBillPeriod,
  formatMoney,
  formatPaymentMethod,
  moneyChange,
} from "../audit/audit.util";
import type {
  BillCardAssignmentSummaryResponse,
  BillCarriedForwardInfo,
  BillCustomerSummaryResponse,
  BillListItemResponse,
  BillListQuery,
  BillListResponse,
  BillPaymentSummaryResponse,
  BillResponse,
  BillSummaryResponse,
  CreatePaymentRequest,
  CustomerBillMonthParams,
  CustomerIdParams,
  CustomerPaymentsParams,
  GenerateBillRequest,
  PageInfo,
  PaymentListItemResponse,
  PaymentListQuery,
  PaymentListResponse,
  PaymentResponse,
  PaymentSummaryResponse,
} from "./bill.types";

type BillRecord = Prisma.BillGetPayload<{
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

type PaymentRecord = Prisma.PaymentGetPayload<{
  include: {
    customer: true;
    bill: true;
    receivedBy: true;
    editedBy: true;
  };
}>;

interface EarlierUnpaidBill {
  id: string;
  billNumber: string;
  outstandingAmount: number;
  month: number;
  year: number;
}

function createHttpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}

function getPrisma(app: FastifyInstance) {
  return (app as FastifyInstance & { prisma: PrismaClient }).prisma;
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function normalizeBillCustomer(customer: any): BillCustomerSummaryResponse {
  return {
    id: customer.id,
    fullName: customer.fullName,
    mobileNumber: customer.mobileNumber,
  };
}

function normalizeBillCardAssignment(cardAssignment: any): BillCardAssignmentSummaryResponse {
  return {
    id: cardAssignment.id,
    cardId: cardAssignment.cardId,
    cardNumber: cardAssignment.card?.cardNumber ?? null,
    assignedAt: cardAssignment.assignedAt.toISOString(),
    unassignedAt: toIso(cardAssignment.unassignedAt),
    depositAtAssignment: cardAssignment.depositAtAssignment ?? 0,
  };
}

function normalizeBillListItem(bill: BillRecord): BillListItemResponse {
  return {
    id: bill.id,
    billNumber: bill.billNumber,
    customerId: bill.customerId,
    customer: normalizeBillCustomer(bill.customer),
    cardAssignment: normalizeBillCardAssignment(bill.cardAssignment),
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
    carriedForward: normalizeCarriedForward(bill),
  };
}

function normalizeCarriedForward(bill: {
  carriedForwardAmount: number;
  carriedForwardToBillId: string | null;
}): BillCarriedForwardInfo | null {
  if (!bill.carriedForwardToBillId || bill.carriedForwardAmount <= 0) return null;

  return {
    amount: bill.carriedForwardAmount,
    toBillId: bill.carriedForwardToBillId,
  };
}

function normalizeBillResponse(
  bill: BillRecord,
  paymentSummary: BillPaymentSummaryResponse,
): BillResponse {
  return {
    ...normalizeBillListItem(bill),
    generatedBy: {
      id: bill.generatedBy.id,
      fullName: bill.generatedBy.fullName,
    },
    milkSummary: (bill.milkSummary ?? []).map((item: any) => ({
      milkTypeId: item.milkTypeId,
      milkTypeName: item.milkTypeName,
      litres: item.litres,
      rate: item.rate,
      amount: item.amount,
    })),
    otherItems: (bill.otherItems ?? []).map((item: any) => ({
      productSuggestionId: item.productSuggestionId ?? null,
      itemName: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
    })),
    notes: bill.notes ?? null,
    paymentSummary,
  };
}

function normalizePaymentCustomer(customer: any) {
  return {
    id: customer.id,
    fullName: customer.fullName,
    mobileNumber: customer.mobileNumber,
  };
}

function normalizePaymentBill(bill: any) {
  return {
    id: bill.id,
    billNumber: bill.billNumber,
    month: bill.month,
    year: bill.year,
    status: bill.status,
    outstandingAmount: bill.outstandingAmount ?? 0,
  };
}

function normalizePaymentUser(user: any) {
  return {
    id: user.id,
    fullName: user.fullName,
  };
}

function normalizePayment(payment: PaymentRecord): PaymentListItemResponse {
  const depositUsed = payment.depositUsed ?? 0;
  return {
    id: payment.id,
    customerId: payment.customerId,
    customer: normalizePaymentCustomer(payment.customer),
    billId: payment.billId,
    bill: normalizePaymentBill(payment.bill),
    billMonth: payment.billMonth,
    billYear: payment.billYear,
    receiptNumber: payment.receiptNumber,
    amount: payment.amount,
    depositUsed,
    creditedAmount: payment.amount + depositUsed,
    paymentMethod: payment.paymentMethod,
    referenceNumber: payment.referenceNumber ?? "",
    notes: payment.notes ?? "",
    receivedAt: payment.receivedAt.toISOString(),
    receivedBy: normalizePaymentUser(payment.receivedBy),
    editedAt: toIso(payment.editedAt),
    editedBy: payment.editedBy ? normalizePaymentUser(payment.editedBy) : null,
  };
}

function buildPageInfo(totalItems: number, page: number, limit: number) {
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pageInfo: PageInfo = {
    page: safePage,
    limit,
    totalItems,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPreviousPage: safePage > 1,
  };

  return { pageInfo, skip: (safePage - 1) * limit };
}

/**
 * Filtering, sorting and pagination all happen in the database.
 *
 * These lists back the bills and payments screens, which grow without bound.
 * Loading every row into memory just to slice a page out of it was the single
 * largest source of request latency in the app.
 */
function buildBillWhere(query: BillListQuery): Prisma.BillWhereInput {
  const where: Prisma.BillWhereInput = {};

  if (query.customerId) where.customerId = query.customerId;
  if (query.month !== undefined) where.month = query.month;
  if (query.year !== undefined) where.year = query.year;
  if (query.status !== undefined) where.status = query.status;

  const search = query.search?.trim();

  if (search) {
    const matches: Prisma.BillWhereInput[] = [
      { billNumber: { contains: search, mode: "insensitive" } },
      { customer: { is: { fullName: { contains: search, mode: "insensitive" } } } },
      { customer: { is: { mobileNumber: { contains: search } } } },
    ];

    // Card numbers are integers, so only an exact match is meaningful.
    const cardNumber = Number(search);
    if (Number.isInteger(cardNumber) && cardNumber > 0) {
      matches.push({ cardAssignment: { is: { card: { is: { cardNumber } } } } });
    }

    where.OR = matches;
  }

  return where;
}

function buildPaymentWhere(query: PaymentListQuery): Prisma.PaymentWhereInput {
  const where: Prisma.PaymentWhereInput = {};

  if (query.customerId) where.customerId = query.customerId;
  if (query.billId) where.billId = query.billId;
  if (query.billMonth !== undefined) where.billMonth = query.billMonth;
  if (query.billYear !== undefined) where.billYear = query.billYear;
  if (query.paymentMethod !== undefined) where.paymentMethod = query.paymentMethod;

  const search = query.search?.trim();

  if (search) {
    where.OR = [
      { receiptNumber: { contains: search, mode: "insensitive" } },
      { referenceNumber: { contains: search, mode: "insensitive" } },
      { customer: { is: { fullName: { contains: search, mode: "insensitive" } } } },
      { customer: { is: { mobileNumber: { contains: search } } } },
      { bill: { is: { billNumber: { contains: search, mode: "insensitive" } } } },
    ];
  }

  return where;
}

const BILL_LIST_INCLUDE = {
  customer: true,
  cardAssignment: { include: { card: true } },
  generatedBy: true,
} satisfies Prisma.BillInclude;

const PAYMENT_LIST_INCLUDE = {
  customer: true,
  bill: true,
  receivedBy: true,
  editedBy: true,
} satisfies Prisma.PaymentInclude;

const BILL_LIST_ORDER = [
  { year: "desc" },
  { month: "desc" },
  { generatedAt: "desc" },
] satisfies Prisma.BillOrderByWithRelationInput[];

/** Money actually received against a bill, ignoring reversed receipts. */
async function loadBillPaymentSummary(
  prisma: PrismaClient,
  billId: string,
): Promise<BillPaymentSummaryResponse> {
  const summary = await prisma.payment.aggregate({
    where: { billId, ...ACTIVE_PAYMENT },
    _count: { _all: true },
    _sum: { amount: true, depositUsed: true },
  });

  return {
    count: summary._count._all,
    totalAmount: (summary._sum.amount ?? 0) + (summary._sum.depositUsed ?? 0),
  };
}

/**
 * Every monetary value in this system is a whole number of rupees. Amounts
 * derived from litres (2.5 L at Rs. 54/L) become money here, and rounding at
 * that boundary is what keeps bills, payments and balances reconciling exactly.
 */
function toRupees(value: number) {
  return Math.round(value);
}

/** Reversed receipts must never count towards money received. */
const ACTIVE_PAYMENT = { reversedAt: null } satisfies Prisma.PaymentWhereInput;

export function getDepositCredit(
  outstanding: number,
  availableDeposit: number,
  _cashAmount: number,
  useDeposit: boolean,
) {
  return useDeposit ? toRupees(Math.min(availableDeposit, outstanding)) : 0;
}

function compareMonthYear(yearA: number, monthA: number, yearB: number, monthB: number) {
  if (yearA !== yearB) {
    return yearA - yearB;
  }

  return monthA - monthB;
}

function getBillNumber(month: number, year: number, cardNumber: number) {
  return `BILL-${String(month).padStart(2, "0")}-${year}-${cardNumber}`;
}

/**
 * The bills whose balance rolls into the bill being generated for
 * `month`/`year` — that is, every still-open bill from an earlier period.
 *
 * Exported so the carry-forward invariant can be tested directly: the balance
 * must move off these bills onto the new one, never be duplicated across both.
 */
export function selectBillsToCarryForward<
  T extends { month: number; year: number; outstandingAmount: number },
>(openBills: T[], month: number, year: number): T[] {
  return openBills.filter(
    (bill) =>
      Number(bill.outstandingAmount ?? 0) > 0 &&
      compareMonthYear(bill.year, bill.month, year, month) < 0,
  );
}

/** Whole-rupee total of the balances being carried forward. */
export function sumCarriedForward(
  bills: { outstandingAmount: number }[],
): number {
  return toRupees(
    bills.reduce((sum, bill) => sum + Number(bill.outstandingAmount ?? 0), 0),
  );
}

export async function getBills(
  app: FastifyInstance,
  query: BillListQuery,
): Promise<BillListResponse> {
  const prisma = getPrisma(app);
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const where = buildBillWhere(query);

  const totalItems = await prisma.bill.count({ where });
  const { pageInfo, skip } = buildPageInfo(totalItems, page, limit);

  const bills = await prisma.bill.findMany({
    where,
    orderBy: BILL_LIST_ORDER,
    skip,
    take: limit,
    include: BILL_LIST_INCLUDE,
  });

  return {
    items: bills.map(normalizeBillListItem),
    pageInfo,
  };
}

export async function getBillById(app: FastifyInstance, billId: string): Promise<BillResponse> {
  const prisma = getPrisma(app);

  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: {
      customer: true,
      cardAssignment: {
        include: {
          card: true,
        },
      },
      generatedBy: true,
    },
  });

  if (!bill) {
    throw createHttpError(404, "Bill not found");
  }

  return normalizeBillResponse(bill, await loadBillPaymentSummary(prisma, billId));
}

export async function getBillsSummary(
  app: FastifyInstance,
  query: BillListQuery,
): Promise<BillSummaryResponse> {
  const prisma = getPrisma(app);
  const where = buildBillWhere(query);

  const [totals, byStatus] = await Promise.all([
    prisma.bill.aggregate({
      where,
      _count: { _all: true },
      _sum: {
        totalMilkLitres: true,
        totalItemsCount: true,
        otherItemsTotal: true,
        grandTotal: true,
        previousDue: true,
        totalPaid: true,
        outstandingAmount: true,
      },
    }),
    prisma.bill.groupBy({ by: ["status"], where, _count: { _all: true } }),
  ]);

  const countFor = (status: BillStatus) =>
    byStatus.find((row: { status: BillStatus; _count: { _all: number } }) => row.status === status)
      ?._count._all ?? 0;

  return {
    totalBills: totals._count._all,
    paidBills: countFor("paid"),
    partialBills: countFor("partial"),
    unpaidBills: countFor("unpaid"),
    carriedForwardBills: countFor("carried_forward"),
    totalMilkLitres: toRupees(totals._sum.totalMilkLitres ?? 0),
    totalItemsCount: totals._sum.totalItemsCount ?? 0,
    otherItemsTotal: totals._sum.otherItemsTotal ?? 0,
    // `grandTotal` on each bill includes the balance carried over from earlier
    // bills. Subtracting `previousDue` gives what was actually billed in this
    // period, so the figure cannot be inflated by a rolled-over balance.
    grandTotal: (totals._sum.grandTotal ?? 0) - (totals._sum.previousDue ?? 0),
    totalPaid: totals._sum.totalPaid ?? 0,
    outstandingAmount: totals._sum.outstandingAmount ?? 0,
  };
}

export async function getCustomerBillByMonth(
  app: FastifyInstance,
  params: CustomerBillMonthParams,
): Promise<BillResponse> {
  const prisma = getPrisma(app);

  const bill = await prisma.bill.findUnique({
    where: {
      customerId_month_year: {
        customerId: params.customerId,
        month: params.month,
        year: params.year,
      },
    },
    include: {
      customer: true,
      cardAssignment: {
        include: {
          card: true,
        },
      },
      generatedBy: true,
    },
  });

  if (!bill) {
    throw createHttpError(404, "Bill not found");
  }

  return normalizeBillResponse(bill, await loadBillPaymentSummary(prisma, bill.id));
}

export async function getBillPayments(
  app: FastifyInstance,
  billId: string,
  query: PaymentListQuery,
): Promise<PaymentListResponse> {
  const prisma = getPrisma(app);

  const bill = await prisma.bill.findUnique({
    where: { id: billId },
  });

  if (!bill) {
    throw createHttpError(404, "Bill not found");
  }

  return getPayments(app, { ...query, billId });
}

export async function getPayments(
  app: FastifyInstance,
  query: PaymentListQuery,
): Promise<PaymentListResponse> {
  const prisma = getPrisma(app);
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const where = buildPaymentWhere(query);

  const totalItems = await prisma.payment.count({ where });
  const { pageInfo, skip } = buildPageInfo(totalItems, page, limit);

  const payments = await prisma.payment.findMany({
    where,
    orderBy: { receivedAt: "desc" },
    skip,
    take: limit,
    include: PAYMENT_LIST_INCLUDE,
  });

  return {
    items: payments.map(normalizePayment),
    pageInfo,
  };
}

export async function getPaymentById(
  app: FastifyInstance,
  paymentId: string,
): Promise<PaymentResponse> {
  const prisma = getPrisma(app);

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      customer: true,
      bill: true,
      receivedBy: true,
      editedBy: true,
    },
  });

  if (!payment) {
    throw createHttpError(404, "Payment not found");
  }

  return normalizePayment(payment);
}

export async function getPaymentsSummary(
  app: FastifyInstance,
  query: PaymentListQuery,
): Promise<PaymentSummaryResponse> {
  const prisma = getPrisma(app);

  // Reversed receipts stay visible in the list but must never be counted as
  // money taken, otherwise the totals here disagree with the customer
  // statement and with every bill's outstanding balance.
  const where: Prisma.PaymentWhereInput = {
    ...buildPaymentWhere(query),
    ...ACTIVE_PAYMENT,
  };

  const [totals, byMethod] = await Promise.all([
    prisma.payment.aggregate({
      where,
      _count: { _all: true },
      _sum: { amount: true, depositUsed: true },
      _max: { receivedAt: true },
    }),
    prisma.payment.groupBy({
      by: ["paymentMethod"],
      where,
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);

  const methodRow = (method: PaymentMethod) =>
    byMethod.find(
      (row: {
        paymentMethod: PaymentMethod;
        _count: { _all: number };
        _sum: { amount: number | null };
      }) => row.paymentMethod === method,
    );

  return {
    totalPayments: totals._count._all,
    totalAmount: totals._sum.amount ?? 0,
    depositApplied: totals._sum.depositUsed ?? 0,
    cashCount: methodRow("cash")?._count._all ?? 0,
    cashAmount: methodRow("cash")?._sum.amount ?? 0,
    upiCount: methodRow("upi")?._count._all ?? 0,
    upiAmount: methodRow("upi")?._sum.amount ?? 0,
    latestPaymentAt: totals._max.receivedAt ? totals._max.receivedAt.toISOString() : null,
  };
}

export async function getOverdueBills(app: FastifyInstance) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const bills = await getPrisma(app).bill.findMany({
    where: { status: { in: ["unpaid", "partial"] }, outstandingAmount: { gt: 0 }, dueDate: { lt: today } },
    include: { customer: true }, orderBy: { dueDate: "asc" },
  });
  const items = bills.map((bill: any) => ({
    id: bill.id, billNumber: bill.billNumber, customerId: bill.customerId, customerName: bill.customer.fullName,
    mobileNumber: bill.customer.mobileNumber, dueDate: bill.dueDate!.toISOString(), outstandingAmount: bill.outstandingAmount,
    daysOverdue: Math.floor((today.getTime() - bill.dueDate!.getTime()) / 86_400_000),
  }));
  const inRange = (from: number, to: number) => items.filter((item: any) => item.daysOverdue >= from && item.daysOverdue <= to).length;
  return { items, summary: { count: items.length, outstandingAmount: items.reduce((sum: number, item: any) => sum + item.outstandingAmount, 0), days1to30: inRange(1, 30), days31to60: inRange(31, 60), days61plus: items.filter((item: any) => item.daysOverdue >= 61).length } };
}

export async function generateBill(
  app: FastifyInstance,
  customerId: string,
  input: GenerateBillRequest,
  performedById: string,
): Promise<BillResponse> {
  const prisma = getPrisma(app);

  const { month, year } = input;

  const existingBill = await prisma.bill.findUnique({
    where: {
      customerId_month_year: {
        customerId,
        month,
        year,
      },
    },
  });

  if (existingBill) {
    throw createHttpError(409, `Bill already exists for ${month}/${year}`);
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    throw createHttpError(404, "Customer not found");
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const ledgers = await prisma.dailyLedger.findMany({
    where: {
      customerId,
      ledgerDate: {
        gte: monthStart,
        lt: monthEnd,
      },
    },
    orderBy: {
      ledgerDate: "asc",
    },
  });

  /**
   * We need the card assignment that was valid
   * during this billing period.
   *
   * Prefer the latest assignment that started
   * before the end of the billing month.
   */
  const cardAssignment = await prisma.cardAssignment.findFirst({
    where: {
      customerId,
      assignedAt: {
        lt: monthEnd,
      },
    },
    orderBy: {
      assignedAt: "desc",
    },
    include: {
      card: true,
    },
  });

  if (!cardAssignment) {
    throw createHttpError(400, "Customer does not have a card assignment for this billing period");
  }

  /**
   * Aggregate milk by milk type + rate.
   *
   * Rate is intentionally part of the key because
   * the same milk type can have different rates
   * during the same month.
   */
  const milkMap = new Map<
    string,
    {
      milkTypeId: string;
      milkTypeName: string;
      litres: number;
      rate: number;
      amount: number;
    }
  >();

  /**
   * Aggregate products by product + unit price.
   *
   * Unit price is part of the key for the same
   * reason as milk rate.
   */
  const productMap = new Map<
    string,
    {
      productSuggestionId: string | null;
      itemName: string;
      quantity: number;
      unitPrice: number;
      amount: number;
    }
  >();

  for (const ledger of ledgers) {
    const entries = (ledger.entries ?? []) as any[];

    for (const entry of entries) {
      for (const milk of entry.milkEntries ?? []) {
        const litres = Number(milk.litres);
        const rate = Number(milk.rate);
        const amount = Number(milk.amount);

        const key = `${milk.milkTypeId}:${rate}`;

        const existing = milkMap.get(key);

        if (existing) {
          existing.litres += litres;
          existing.amount += amount;
        } else {
          milkMap.set(key, {
            milkTypeId: milk.milkTypeId,
            milkTypeName: milk.milkTypeName,
            litres,
            rate,
            amount,
          });
        }
      }

      for (const product of entry.productEntries ?? []) {
        const quantity = Number(product.quantity);
        const unitPrice = Number(product.unitPrice);
        const amount = Number(product.amount);

        const key = `${product.productSuggestionId ?? "custom"}:${product.itemName}:${unitPrice}`;

        const existing = productMap.get(key);

        if (existing) {
          existing.quantity += quantity;
          existing.amount += amount;
        } else {
          productMap.set(key, {
            productSuggestionId: product.productSuggestionId ?? null,
            itemName: product.itemName,
            quantity,
            unitPrice,
            amount,
          });
        }
      }
    }
  }

  const milkSummary = [...milkMap.values()].map((item) => ({
    milkTypeId: item.milkTypeId,
    milkTypeName: item.milkTypeName,
    litres: Math.round(item.litres * 100) / 100,
    rate: toRupees(item.rate),
    amount: toRupees(item.amount),
  }));

  const otherItems = [...productMap.values()].map((item) => ({
    productSuggestionId: item.productSuggestionId,
    itemName: item.itemName,
    quantity: item.quantity,
    unitPrice: toRupees(item.unitPrice),
    amount: toRupees(item.amount),
  }));

  const totalMilkLitres = Math.round(milkSummary.reduce((sum, item) => sum + item.litres, 0) * 100) / 100;

  const otherItemsTotal = toRupees(otherItems.reduce((sum, item) => sum + item.amount, 0));

  const totalItemsCount = otherItems.reduce((sum, item) => sum + item.quantity, 0);

  /**
   * Unpaid balances from earlier bills roll into this one.
   *
   * The balance MOVES: each earlier bill has its `outstandingAmount` cleared
   * and recorded in `carriedForwardAmount` instead, so the debt exists in
   * exactly one place. Summing `outstandingAmount` across a customer's bills
   * now gives their true balance; previously the same rupees were counted once
   * on the old bill and again inside this bill's `previousDue`, which inflated
   * every receivable figure and compounded month over month.
   */
  const openBills: EarlierUnpaidBill[] = await prisma.bill.findMany({
    where: { customerId, outstandingAmount: { gt: 0 } },
    select: { id: true, billNumber: true, outstandingAmount: true, month: true, year: true },
  });

  const earlierUnpaidBills = selectBillsToCarryForward(openBills, month, year);

  const previousDue = sumCarriedForward(earlierUnpaidBills);

  const currentCharges = toRupees(
    milkSummary.reduce((sum, item) => sum + item.amount, 0) + otherItemsTotal,
  );

  const grandTotal = currentCharges + previousDue;

  const billDate = new Date(Date.UTC(year, month, 0));
  const dueDate = new Date(Date.UTC(year, month, 10));

  const billNumber = getBillNumber(month, year, cardAssignment.card.cardNumber);

  const createdBill = await prisma.$transaction(async (tx: PrismaClient) => {
    const bill = await tx.bill.create({
      data: {
        billNumber,
        customerId,
        cardAssignmentId: cardAssignment.id,
        month,
        year,
        billDate,
        dueDate,

        totalMilkLitres,
        milkSummary: milkSummary as any,

        totalItemsCount,
        otherItems: otherItems as any,
        otherItemsTotal,

        previousDue,
        grandTotal,

        totalPaid: 0,
        outstandingAmount: grandTotal,
        status: grandTotal === 0 ? "paid" : "unpaid",

        billVersion: 1,
        generatedById: performedById,
      },
      include: {
        customer: true,
        cardAssignment: {
          include: {
            card: true,
          },
        },
        generatedBy: true,
      },
    });

    // Move the old balances onto this bill so they are never counted twice.
    for (const earlier of earlierUnpaidBills) {
      await tx.bill.update({
        where: { id: earlier.id },
        data: {
          outstandingAmount: 0,
          carriedForwardAmount: toRupees(Number(earlier.outstandingAmount ?? 0)),
          carriedForwardToBillId: bill.id,
          status: "carried_forward",
        },
      });
    }

    await tx.auditLog.create({
      data: {
        customerId,
        type: "bill_generated",
        title: `Bill ${bill.billNumber} generated for ${formatBillPeriod(month, year)}`,
        details: [
          change(AUDIT_FIELD.billNumber, "", bill.billNumber),
          change(AUDIT_FIELD.billPeriod, "", formatBillPeriod(month, year)),
          moneyChange(AUDIT_FIELD.billTotal, null, grandTotal),
          ...(previousDue > 0
            ? [
                change(
                  AUDIT_FIELD.previousDue,
                  earlierUnpaidBills
                    .map((earlier: EarlierUnpaidBill) => earlier.billNumber)
                    .join(", "),
                  formatMoney(previousDue),
                ),
              ]
            : []),
        ],
        performedById,
        relatedEntityType: "bill",
        relatedEntityId: bill.id,
      } as any,
    });

    return bill;
  });

  return getBillById(app, createdBill.id);
}

async function getReceiptNumber(tx: PrismaClient, year: number) {
  const counter = await tx.counter.upsert({
    where: { id: `receipt-${year}` },
    create: { id: `receipt-${year}`, nextNumber: 2 },
    update: { nextNumber: { increment: 1 } },
  });
  return `REC-${year}-${String(counter.nextNumber - 1).padStart(4, "0")}`;
}

export async function recordPayment(
  app: FastifyInstance,
  input: CreatePaymentRequest,
  performedById: string,
): Promise<PaymentResponse> {
  const prisma = getPrisma(app);

  const previousPayment = await prisma.payment.findUnique({
    where: { clientRequestId: input.clientRequestId },
    include: { customer: true, bill: true, receivedBy: true, editedBy: true },
  });
  if (previousPayment) return normalizePayment(previousPayment);

  const payment = await prisma.$transaction(async (tx: PrismaClient) => {
    const bill = await tx.bill.findUnique({
      where: { id: input.billId },
      include: {
        customer: true,
      },
    });

    if (!bill) {
      throw createHttpError(404, "Bill not found");
    }

    if (bill.status === "carried_forward") {
      throw createHttpError(
        409,
        "This bill's balance was carried forward to a later bill. Record the payment against that bill instead.",
      );
    }

    if (bill.status === "paid" || Number(bill.outstandingAmount) <= 0) {
      throw createHttpError(409, "This bill has no outstanding amount");
    }

    const amount = toRupees(input.amount);
    const outstanding = toRupees(Number(bill.outstandingAmount));
    const availableDeposit = toRupees(Number(bill.customer.depositAmount ?? 0));

    if (amount > outstanding) {
      throw createHttpError(
        400,
        `Payment cannot exceed the outstanding amount of ${formatMoney(outstanding)}`,
      );
    }

    const depositUsed = getDepositCredit(outstanding, availableDeposit, amount, input.useDeposit);
    const creditedAmount = amount + depositUsed;

    if (creditedAmount <= 0 || creditedAmount > outstanding) {
      throw createHttpError(400, "Payment and deposit credit cannot exceed the outstanding amount");
    }

    const receiptNumber = await getReceiptNumber(tx, bill.year);

    const totalPaid = toRupees(Number(bill.totalPaid) + creditedAmount);

    const newOutstanding = toRupees(Number(bill.grandTotal) - totalPaid);

    const status = newOutstanding <= 0 ? "paid" : totalPaid > 0 ? "partial" : "unpaid";

    const createdPayment = await tx.payment.create({
      data: {
        customerId: bill.customerId,
        billId: bill.id,
        billMonth: bill.month,
        billYear: bill.year,

        receiptNumber,
        clientRequestId: input.clientRequestId,
        amount,
        depositUsed,

        paymentMethod: input.paymentMethod,
        referenceNumber: input.referenceNumber ?? "",
        notes: input.notes ?? "",

        receivedById: performedById,
      },
      include: {
        customer: true,
        bill: true,
        receivedBy: true,
        editedBy: true,
      },
    });

    await tx.bill.update({
      where: { id: bill.id },
      data: {
        totalPaid,
        outstandingAmount: Math.max(0, newOutstanding),
        status,
      },
    });

    const depositAfter = availableDeposit - depositUsed;

    if (depositUsed > 0) {
      await tx.customer.update({
        where: { id: bill.customerId },
        data: { depositAmount: depositAfter, updatedById: performedById },
      });
      await tx.depositTransaction.create({
        data: {
          customerId: bill.customerId,
          type: "bill_applied",
          amount: -depositUsed,
          balanceAfter: depositAfter,
          reference: receiptNumber,
          performedById,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        customerId: bill.customerId,
        type: "payment_added",
        title: `Payment of ${formatMoney(creditedAmount)} received against ${bill.billNumber}`,
        details: [
          change(AUDIT_FIELD.receiptNumber, "", receiptNumber),
          moneyChange(AUDIT_FIELD.amountReceived, null, amount),
          change(AUDIT_FIELD.paymentMethod, "", formatPaymentMethod(input.paymentMethod)),
          ...(depositUsed > 0
            ? [moneyChange(AUDIT_FIELD.depositApplied, null, depositUsed)]
            : []),
          moneyChange(AUDIT_FIELD.outstanding, outstanding, Math.max(0, newOutstanding)),
        ],
        performedById,
        relatedEntityType: "payment",
        relatedEntityId: createdPayment.id,
      } as any,
    });

    if (depositUsed > 0) {
      await tx.auditLog.create({
        data: {
          customerId: bill.customerId,
          type: "deposit_updated",
          title: `${formatMoney(depositUsed)} deposit applied to ${bill.billNumber}`,
          details: [moneyChange(AUDIT_FIELD.depositBalance, availableDeposit, depositAfter)],
          performedById,
          relatedEntityType: "payment",
          relatedEntityId: createdPayment.id,
        } as any,
      });
    }

    return createdPayment;
  });

  return normalizePayment(payment);
}

export async function reversePayment(app: FastifyInstance, paymentId: string, reason: string, performedById: string) {
  const prisma = getPrisma(app);
  const payment = await prisma.$transaction(async (tx: PrismaClient) => {
    const existing = await tx.payment.findUnique({ where: { id: paymentId }, include: { bill: true } });
    if (!existing) throw createHttpError(404, "Payment not found");
    if (existing.reversedAt) throw createHttpError(409, "Payment is already reversed");

    const laterBill = await tx.bill.findFirst({ where: { customerId: existing.customerId, OR: [{ year: { gt: existing.bill.year } }, { year: existing.bill.year, month: { gt: existing.bill.month } }] } });
    if (laterBill) throw createHttpError(409, "Reverse this payment before generating a later bill");

    const creditedAmount = toRupees(existing.amount + (existing.depositUsed ?? 0));
    const outstandingAmount = toRupees(existing.bill.outstandingAmount + creditedAmount);
    const totalPaid = toRupees(existing.bill.totalPaid - creditedAmount);
    const status = outstandingAmount >= existing.bill.grandTotal ? "unpaid" : "partial";

    await tx.bill.update({
      where: { id: existing.billId },
      data: { totalPaid: Math.max(0, totalPaid), outstandingAmount, status },
    });

    let depositBefore = 0;
    let depositAfter = 0;

    if (existing.depositUsed > 0) {
      const customer = await tx.customer.update({
        where: { id: existing.customerId },
        data: {
          depositAmount: { increment: existing.depositUsed },
          updatedById: performedById,
        },
      });

      depositAfter = customer.depositAmount;
      depositBefore = depositAfter - existing.depositUsed;

      await tx.depositTransaction.create({
        data: {
          customerId: existing.customerId,
          type: "payment_reversal",
          amount: existing.depositUsed,
          balanceAfter: customer.depositAmount,
          reference: existing.receiptNumber,
          notes: reason,
          performedById,
        },
      });
    }

    const reversed = await tx.payment.update({
      where: { id: existing.id },
      data: { reversedAt: new Date(), reversalReason: reason, reversedById: performedById },
      include: { customer: true, bill: true, receivedBy: true, editedBy: true },
    });

    await tx.auditLog.create({
      data: {
        customerId: existing.customerId,
        type: "payment_reversed",
        title: `Payment ${existing.receiptNumber} of ${formatMoney(creditedAmount)} reversed`,
        details: [
          change(AUDIT_FIELD.receiptNumber, "", existing.receiptNumber),
          moneyChange(AUDIT_FIELD.amountReceived, creditedAmount, 0),
          change(AUDIT_FIELD.reason, "", reason),
          moneyChange(
            AUDIT_FIELD.outstanding,
            existing.bill.outstandingAmount,
            outstandingAmount,
          ),
          ...(existing.depositUsed > 0
            ? [moneyChange(AUDIT_FIELD.depositBalance, depositBefore, depositAfter)]
            : []),
        ],
        performedById,
        relatedEntityType: "payment",
        relatedEntityId: existing.id,
      } as any,
    });

    return reversed;
  });
  return normalizePayment(payment);
}
