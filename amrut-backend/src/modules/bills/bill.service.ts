import type { FastifyInstance } from "fastify";
import type { Prisma, PrismaClient } from "../../../generated/prisma/client";
import type {
  BillCardAssignmentSummaryResponse,
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
    creditedAmount: round2(payment.amount + depositUsed),
    paymentMethod: payment.paymentMethod,
    referenceNumber: payment.referenceNumber ?? "",
    notes: payment.notes ?? "",
    receivedAt: payment.receivedAt.toISOString(),
    receivedBy: normalizePaymentUser(payment.receivedBy),
    editedAt: toIso(payment.editedAt),
    editedBy: payment.editedBy ? normalizePaymentUser(payment.editedBy) : null,
  };
}

function paginate<T>(items: T[], page: number, limit: number) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;
  const paginatedItems = items.slice(start, start + limit);

  const pageInfo: PageInfo = {
    page: safePage,
    limit,
    totalItems,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPreviousPage: safePage > 1,
  };

  return { paginatedItems, pageInfo };
}

function includesSearch(value: string | null | undefined, search: string) {
  if (!value) return false;
  return value.toLowerCase().includes(search.toLowerCase());
}

async function loadBills(app: FastifyInstance, query: BillListQuery) {
  const prisma = getPrisma(app);

  const where: any = {};

  if (query.customerId) where.customerId = query.customerId;
  if (query.month !== undefined) where.month = query.month;
  if (query.year !== undefined) where.year = query.year;
  if (query.status !== undefined) where.status = query.status;

  const bills = await prisma.bill.findMany({
    where,
    orderBy: [{ year: "desc" }, { month: "desc" }, { generatedAt: "desc" }],
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

  let normalized = bills.map(normalizeBillListItem);

  if (query.search) {
    const search = query.search.trim();
    normalized = normalized.filter((bill: BillListItemResponse) => {
      return (
        includesSearch(bill.billNumber, search) ||
        includesSearch(bill.customer.fullName, search) ||
        includesSearch(bill.customer.mobileNumber, search) ||
        includesSearch(String(bill.cardAssignment.cardNumber ?? ""), search)
      );
    });
  }

  return normalized;
}

async function loadPayments(app: FastifyInstance, query: PaymentListQuery) {
  const prisma = getPrisma(app);

  const where: any = {};

  if (query.customerId) where.customerId = query.customerId;
  if (query.billId) where.billId = query.billId;
  if (query.billMonth !== undefined) where.billMonth = query.billMonth;
  if (query.billYear !== undefined) where.billYear = query.billYear;
  if (query.paymentMethod !== undefined) where.paymentMethod = query.paymentMethod;

  const payments = await prisma.payment.findMany({
    where,
    orderBy: [{ receivedAt: "desc" }],
    include: {
      customer: true,
      bill: true,
      receivedBy: true,
      editedBy: true,
    },
  });

  let normalized = payments.map(normalizePayment);

  if (query.search) {
    const search = query.search.trim();
    normalized = normalized.filter((payment: PaymentListItemResponse) => {
      return (
        includesSearch(payment.receiptNumber, search) ||
        includesSearch(payment.referenceNumber, search) ||
        includesSearch(payment.customer.fullName, search) ||
        includesSearch(payment.customer.mobileNumber, search) ||
        includesSearch(payment.bill.billNumber, search)
      );
    });
  }

  return normalized;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getDepositCredit(
  outstanding: number,
  availableDeposit: number,
  _cashAmount: number,
  useDeposit: boolean,
) {
  return useDeposit ? round2(Math.min(availableDeposit, outstanding)) : 0;
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

export async function getBills(
  app: FastifyInstance,
  query: BillListQuery,
): Promise<BillListResponse> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const allBills = await loadBills(app, query);
  const { paginatedItems, pageInfo } = paginate(allBills, page, limit);

  return {
    items: paginatedItems as BillListItemResponse[],
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

  const payments = await prisma.payment.findMany({
    where: { billId },
  });

  const paymentSummary: BillPaymentSummaryResponse = {
    count: payments.length,
    totalAmount: payments.reduce(
      (sum: number, payment: { amount: number | null; depositUsed?: number | null }) =>
        sum + (payment.amount ?? 0) + (payment.depositUsed ?? 0),
      0,
    ),
  };

  return normalizeBillResponse(bill, paymentSummary);
}

export async function getBillsSummary(
  app: FastifyInstance,
  query: BillListQuery,
): Promise<BillSummaryResponse> {
  const bills = (await loadBills(app, query)) as BillListItemResponse[];

  return {
    totalBills: bills.length,
    paidBills: bills.filter((bill) => bill.status === "paid").length,
    partialBills: bills.filter((bill) => bill.status === "partial").length,
    unpaidBills: bills.filter((bill) => bill.status === "unpaid").length,
    totalMilkLitres: bills.reduce((sum, bill) => sum + (bill.totalMilkLitres ?? 0), 0),
    totalItemsCount: bills.reduce((sum, bill) => sum + (bill.totalItemsCount ?? 0), 0),
    otherItemsTotal: bills.reduce((sum, bill) => sum + (bill.otherItemsTotal ?? 0), 0),
    grandTotal: bills.reduce((sum, bill) => sum + (bill.grandTotal ?? 0), 0),
    totalPaid: bills.reduce((sum, bill) => sum + (bill.totalPaid ?? 0), 0),
    outstandingAmount: bills.reduce((sum, bill) => sum + (bill.outstandingAmount ?? 0), 0),
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

  const payments = await prisma.payment.findMany({
    where: { billId: bill.id },
  });

  const paymentSummary: BillPaymentSummaryResponse = {
    count: payments.length,
    totalAmount: payments.reduce(
      (sum: number, payment: { amount: number | null; depositUsed?: number | null }) =>
        sum + (payment.amount ?? 0) + (payment.depositUsed ?? 0),
      0,
    ),
  };

  return normalizeBillResponse(bill, paymentSummary);
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

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const allPayments = await loadPayments(app, {
    ...query,
    billId,
  });

  const { paginatedItems, pageInfo } = paginate(allPayments, page, limit);

  return {
    items: paginatedItems as PaymentListItemResponse[],
    pageInfo,
  };
}

export async function getPayments(
  app: FastifyInstance,
  query: PaymentListQuery,
): Promise<PaymentListResponse> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const allPayments = await loadPayments(app, query);
  const { paginatedItems, pageInfo } = paginate(allPayments, page, limit);

  return {
    items: paginatedItems as PaymentListItemResponse[],
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
  const payments = (await loadPayments(app, query)) as PaymentListItemResponse[];

  const cashPayments = payments.filter((payment) => payment.paymentMethod === "cash");
  const upiPayments = payments.filter((payment) => payment.paymentMethod === "upi");

  return {
    totalPayments: payments.length,
    totalAmount: payments.reduce(
      (sum: number, payment: { amount: number | null }) => sum + (payment.amount ?? 0),
      0,
    ),
    cashCount: cashPayments.length,
    cashAmount: cashPayments.reduce(
      (sum: number, payment: { amount: number | null }) => sum + (payment.amount ?? 0),
      0,
    ),
    upiCount: upiPayments.length,
    upiAmount: upiPayments.reduce(
      (sum: number, payment: { amount: number | null }) => sum + (payment.amount ?? 0),
      0,
    ),
    latestPaymentAt: payments[0]?.receivedAt ?? null,
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
    litres: round2(item.litres),
    rate: round2(item.rate),
    amount: round2(item.amount),
  }));

  const otherItems = [...productMap.values()].map((item) => ({
    productSuggestionId: item.productSuggestionId,
    itemName: item.itemName,
    quantity: item.quantity,
    unitPrice: round2(item.unitPrice),
    amount: round2(item.amount),
  }));

  const totalMilkLitres = round2(milkSummary.reduce((sum, item) => sum + item.litres, 0));

  const otherItemsTotal = round2(otherItems.reduce((sum, item) => sum + item.amount, 0));

  const totalItemsCount = otherItems.reduce((sum, item) => sum + item.quantity, 0);

  /**
   * Previous due = outstanding amount from bills
   * before this billing month.
   */
  const previousBills: { outstandingAmount?: number | null; month: number; year: number }[] =
    await prisma.bill.findMany({
      where: {
        customerId,
      },
      select: {
        outstandingAmount: true,
        month: true,
        year: true,
      },
    });

  const previousDue = round2(
    previousBills.reduce(
      (sum: number, bill: { outstandingAmount?: number | null; month: number; year: number }) => {
        const isPrevious = compareMonthYear(bill.year, bill.month, year, month) < 0;

        return isPrevious ? sum + Number(bill.outstandingAmount ?? 0) : sum;
      },
      0,
    ),
  );

  const grandTotal = round2(
    milkSummary.reduce((sum, item) => sum + item.amount, 0) + otherItemsTotal + previousDue,
  );

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

    await tx.auditLog.create({
      data: {
        customerId,
        type: "bill_generated",
        title: `Bill generated: ${bill.billNumber}`,
        details: [
          {
            field: "billNumber",
            oldValue: "",
            newValue: bill.billNumber,
          },
          {
            field: "grandTotal",
            oldValue: "",
            newValue: String(grandTotal),
          },
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

    if (bill.status === "paid" || Number(bill.outstandingAmount) <= 0) {
      throw createHttpError(409, "This bill has no outstanding amount");
    }

    const amount = round2(input.amount);
    const outstanding = round2(Number(bill.outstandingAmount));
    const availableDeposit = round2(Number(bill.customer.depositAmount ?? 0));

    if (amount > outstanding) {
      throw createHttpError(
        400,
        `Payment cannot exceed outstanding amount of ₹${outstanding.toFixed(2)}`,
      );
    }

    const depositUsed = getDepositCredit(outstanding, availableDeposit, amount, input.useDeposit);
    const creditedAmount = round2(amount + depositUsed);

    if (creditedAmount <= 0 || creditedAmount > outstanding) {
      throw createHttpError(400, "Payment and deposit credit cannot exceed the outstanding amount");
    }

    const receiptNumber = await getReceiptNumber(tx, bill.year);

    const totalPaid = round2(Number(bill.totalPaid) + creditedAmount);

    const newOutstanding = round2(Number(bill.grandTotal) - totalPaid);

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

    if (depositUsed > 0) {
      await tx.customer.update({
        where: { id: bill.customerId },
        data: { depositAmount: round2(availableDeposit - depositUsed), updatedById: performedById },
      });
      await tx.depositTransaction.create({ data: { customerId: bill.customerId, type: "bill_applied", amount: -depositUsed, balanceAfter: round2(availableDeposit - depositUsed), reference: receiptNumber, performedById } });
    }

    await tx.auditLog.create({
      data: {
        customerId: bill.customerId,
        type: "payment_added",
        title: `Payment received: ${receiptNumber}`,
        details: [
          {
            field: "amount",
            oldValue: "",
            newValue: String(amount),
          },
          {
            field: "paymentMethod",
            oldValue: "",
            newValue: input.paymentMethod,
          },
          ...(depositUsed > 0
            ? [
                {
                  field: "depositUsed",
                  oldValue: String(availableDeposit),
                  newValue: String(round2(availableDeposit - depositUsed)),
                },
              ]
            : []),
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
          title: `Deposit used for ${bill.billNumber}`,
          details: [
            {
              field: "depositAmount",
              oldValue: String(availableDeposit),
              newValue: String(round2(availableDeposit - depositUsed)),
            },
          ],
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

    const creditedAmount = round2(existing.amount + (existing.depositUsed ?? 0));
    const outstandingAmount = round2(existing.bill.outstandingAmount + creditedAmount);
    const totalPaid = round2(existing.bill.totalPaid - creditedAmount);
    const status = outstandingAmount >= existing.bill.grandTotal ? "unpaid" : "partial";

    await tx.bill.update({ where: { id: existing.billId }, data: { totalPaid: Math.max(0, totalPaid), outstandingAmount, status } });
    if (existing.depositUsed > 0) {
      const customer = await tx.customer.update({ where: { id: existing.customerId }, data: { depositAmount: { increment: existing.depositUsed }, updatedById: performedById } });
      await tx.depositTransaction.create({ data: { customerId: existing.customerId, type: "payment_reversal", amount: existing.depositUsed, balanceAfter: customer.depositAmount, reference: existing.receiptNumber, notes: reason, performedById } });
    }
    const reversed = await tx.payment.update({ where: { id: existing.id }, data: { reversedAt: new Date(), reversalReason: reason, reversedById: performedById }, include: { customer: true, bill: true, receivedBy: true, editedBy: true } });
    await tx.auditLog.create({ data: { customerId: existing.customerId, type: "payment_reversed", title: `Payment reversed: ${existing.receiptNumber}`, details: [{ field: "reason", oldValue: "", newValue: reason }], performedById, relatedEntityType: "payment", relatedEntityId: existing.id } as any });
    return reversed;
  });
  return normalizePayment(payment);
}
