import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "../generated/prisma/client";

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;
const TEMP_PASSWORD = "Password@123";

const now = new Date();

function d(
  year: number,
  monthIndex: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  return new Date(year, monthIndex, day, hour, minute, second, 0);
}

function normalizeSearchName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function sum(values: number[]): number {
  return money(values.reduce((acc, value) => acc + value, 0));
}

// function pick<T>(items: T[], index: number): T {
//   if (items.length === 0) {
//     throw new Error("Cannot pick from an empty array");
//   }
//   return items[index % items.length];
// }

function billMonthLabel(month: number, year: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

const USER_SEED = [
  {
    fullName: "Naimish Sojitra",
    mobileNumber: "9876543210",
    email: "user1@gmail.com",
    role: "owner" as const,
    status: "active" as const,
    lastLoginAt: d(2026, 5, 10, 9, 0),
    createdAt: d(2026, 0, 1),
    updatedAt: d(2026, 5, 10),
  },
  {
    fullName: "Ashvinbhai Sojitra",
    mobileNumber: "9876543211",
    email: "user2@gmail.com",
    role: "manager" as const,
    status: "active" as const,
    lastLoginAt: d(2026, 5, 10, 8, 45),
    createdAt: d(2026, 0, 1),
    updatedAt: d(2026, 5, 10),
  },
  {
    fullName: "Harsh Sojitra",
    mobileNumber: "9876543212",
    email: "user3@gmail.com",
    role: "manager" as const,
    status: "active" as const,
    lastLoginAt: d(2026, 5, 9, 20, 30),
    createdAt: d(2026, 0, 1),
    updatedAt: d(2026, 5, 9),
  },
  {
    fullName: "Raj Patel",
    mobileNumber: "9876543213",
    email: "user4@gmail.com",
    role: "employee" as const,
    status: "active" as const,
    lastLoginAt: d(2026, 5, 10, 10, 15),
    createdAt: d(2026, 1, 15),
    updatedAt: d(2026, 5, 10),
  },
  {
    fullName: "Milan Joshi",
    mobileNumber: "9876543214",
    email: "user5@gmail.com",
    role: "employee" as const,
    status: "inactive" as const,
    lastLoginAt: d(2026, 4, 28, 17, 20),
    createdAt: d(2026, 2, 1),
    updatedAt: d(2026, 4, 28),
  },
];

const MILK_TYPE_SEED = [
  {
    name: "Buffalo 54",
    rate: 54,
    shortCode: "BUF54",
    status: "active" as const,
    displayOrder: 1,
    createdAt: d(2026, 0, 1),
    updatedAt: d(2026, 0, 1),
  },
  {
    name: "Buffalo 58",
    rate: 58,
    shortCode: "BUF58",
    status: "active" as const,
    displayOrder: 2,
    createdAt: d(2026, 0, 1),
    updatedAt: d(2026, 0, 1),
  },
  {
    name: "Buffalo 64",
    rate: 64,
    shortCode: "BUF64",
    status: "active" as const,
    displayOrder: 3,
    createdAt: d(2026, 0, 1),
    updatedAt: d(2026, 0, 1),
  },
  {
    name: "Cow 58",
    rate: 58,
    shortCode: "COW58",
    status: "active" as const,
    displayOrder: 4,
    createdAt: d(2026, 0, 1),
    updatedAt: d(2026, 0, 1),
  },
  {
    name: "Buffalo 50",
    rate: 50,
    shortCode: "BUF50",
    status: "inactive" as const,
    displayOrder: 5,
    createdAt: d(2025, 0, 1),
    updatedAt: d(2025, 11, 31),
  },
  {
    name: "Buffalo 54",
    rate: 54,
    shortCode: "BUF54-OLD",
    status: "inactive" as const,
    displayOrder: 6,
    createdAt: d(2025, 0, 1),
    updatedAt: d(2025, 11, 31),
  },
  {
    name: "Buffalo 60",
    rate: 60,
    shortCode: "BUF60",
    status: "inactive" as const,
    displayOrder: 7,
    createdAt: d(2025, 0, 1),
    updatedAt: d(2025, 11, 31),
  },
  {
    name: "Cow 54",
    rate: 54,
    shortCode: "COW54",
    status: "inactive" as const,
    displayOrder: 8,
    createdAt: d(2025, 0, 1),
    updatedAt: d(2025, 11, 31),
  },
];

const PRODUCT_SEED = [
  "Bread",
  "Butter",
  "Cheese",
  "Toast",
  "Chocolate",
  "Biscuit",
  "Chaas",
  "Paneer",
  "Khari",
  "Pav",
  "Wafer",
  "Dahi",
  "Shri Khand",
  "Basundi",
  "Ghorvu",
  "Milkshake",
  "Sweet Corn",
  "Namkeen",
  "Cookies",
  "Ghee",
].map((name, index) => ({
  name,
  displayOrder: index + 1,
  status: "active" as const,
  createdAt: d(2026, 0, 1),
  updatedAt: d(2026, 0, 1),
}));

const CUSTOMER_NAME_SEED = [
  "Naimish Patel",
  "Mahesh Patel",
  "Rakesh Joshi",
  "Ketan Shah",
  "Priya Mehta",
];

type SeedUser = { id: string; fullName: string };
type SeedMilkType = { id: string; name: string; rate: number; status: string };
type SeedProduct = { id: string; name: string; displayOrder: number };
type SeedCard = { id: string; cardNumber: number; status: string };
type SeedCustomer = {
  id: string;
  fullName: string;
  mobileNumber: string;
  address: string;
  depositAmount: number;
  status: "active" | "archived";
  milkTypes: { milkTypeId: string; isDefault: boolean }[];
};
type SeedAssignment = {
  id: string;
  cardId: string;
  customerId: string;
  assignedAt: Date;
  unassignedAt: Date | null;
};

function makeMilkEntry(
  milkType: SeedMilkType,
  litres: number,
): {
  milkTypeId: string;
  milkTypeName: string;
  rate: number;
  litres: number;
  amount: number;
} {
  return {
    milkTypeId: milkType.id,
    milkTypeName: milkType.name,
    rate: milkType.rate,
    litres: money(litres),
    amount: money(litres * milkType.rate),
  };
}

function makeProductEntry(
  product: SeedProduct,
  quantity: number,
  unitPrice: number,
) {
  return {
    productSuggestionId: product.id,
    itemName: product.name,
    quantity,
    unitPrice: money(unitPrice),
    amount: money(quantity * unitPrice),
  };
}

function aggregateMilkSummary(
  entries: Array<{
    milkEntries: Array<{
      milkTypeId: string;
      milkTypeName: string;
      rate: number;
      litres: number;
      amount: number;
    }>;
  }>,
) {
  const map = new Map<
    string,
    {
      milkTypeId: string;
      milkTypeName: string;
      litres: number;
      rate: number;
      amount: number;
    }
  >();

  for (const ledgerEntry of entries) {
    for (const milkEntry of ledgerEntry.milkEntries) {
      const key = milkEntry.milkTypeId;
      const existing = map.get(key);

      if (existing) {
        existing.litres = money(existing.litres + milkEntry.litres);
        existing.amount = money(existing.amount + milkEntry.amount);
      } else {
        map.set(key, { ...milkEntry });
      }
    }
  }

  return [...map.values()];
}

function aggregateProductSummary(
  entries: Array<{
    productEntries: Array<{
      productSuggestionId?: string | null;
      itemName: string;
      quantity: number;
      unitPrice: number;
      amount: number;
    }>;
  }>,
) {
  const map = new Map<
    string,
    {
      productSuggestionId?: string | null;
      itemName: string;
      quantity: number;
      unitPrice: number;
      amount: number;
    }
  >();

  for (const ledgerEntry of entries) {
    for (const productEntry of ledgerEntry.productEntries) {
      const key = `${productEntry.productSuggestionId ?? "manual"}|${productEntry.itemName}|${productEntry.unitPrice}`;
      const existing = map.get(key);

      if (existing) {
        existing.quantity += productEntry.quantity;
        existing.amount = money(existing.amount + productEntry.amount);
      } else {
        map.set(key, { ...productEntry });
      }
    }
  }

  return [...map.values()];
}

async function main() {
  console.log("Seeding Amrut Ledger database...");

  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.dailyLedger.deleteMany();
  await prisma.cardAssignment.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.card.deleteMany();
  await prisma.productSuggestion.deleteMany();
  await prisma.milkType.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, SALT_ROUNDS);

  const users: SeedUser[] = [];
  for (const seed of USER_SEED) {
    const user = await prisma.user.create({
      data: {
        fullName: seed.fullName,
        mobileNumber: seed.mobileNumber,
        email: seed.email,
        passwordHash,
        refreshTokenHash: null,
        role: seed.role,
        status: seed.status,
        lastLoginAt: seed.lastLoginAt,
        failedLoginAttempts: 0,
        lockUntil: null,
        createdAt: seed.createdAt,
        updatedAt: seed.updatedAt,
      },
    });

    users.push({ id: user.id, fullName: user.fullName });
  }

  const milkTypes: SeedMilkType[] = [];
  for (const seed of MILK_TYPE_SEED) {
    const milkType = await prisma.milkType.create({
      data: {
        name: seed.name,
        rate: seed.rate,
        shortCode: seed.shortCode,
        status: seed.status,
        displayOrder: seed.displayOrder,
        createdAt: seed.createdAt,
        updatedAt: seed.updatedAt,
      },
    });

    milkTypes.push({
      id: milkType.id,
      name: milkType.name,
      rate: milkType.rate,
      status: milkType.status,
    });
  }

  const products: SeedProduct[] = [];
  for (const seed of PRODUCT_SEED) {
    const product = await prisma.productSuggestion.create({
      data: {
        name: seed.name,
        displayOrder: seed.displayOrder,
        status: seed.status,
        createdAt: seed.createdAt,
        updatedAt: seed.updatedAt,
      },
    });

    products.push({
      id: product.id,
      name: product.name,
      displayOrder: product.displayOrder,
    });
  }

  const cards: SeedCard[] = [];
  for (let cardNumber = 1; cardNumber <= 40; cardNumber += 1) {
    const card = await prisma.card.create({
      data: {
        cardNumber,
        status: cardNumber <= 30 ? "assigned" : "available",
        createdAt: d(2026, 0, 1),
      },
    });

    cards.push({
      id: card.id,
      cardNumber: card.cardNumber,
      status: card.status,
    });
  }

  const activeMilkTypes = milkTypes.filter(
    (milkType) => milkType.status === "active",
  );
  const activeProducts = products;

  const customers: SeedCustomer[] = [];
  for (let index = 0; index < 48; index += 1) {
    const fullName = CUSTOMER_NAME_SEED[index] ?? `Customer ${index + 1}`;
    const mobileNumber = `987650${String(index + 1).padStart(5, "0")}`;
    const depositAmount = ([2000, 2500, 3000] as const)[index % 3] as
      2000 | 2500 | 3000;
    const isArchived = index >= 40;

    const milkTypeCount = index === 2 || index % 6 === 0 ? 2 : 1;
    const customerMilkTypes = activeMilkTypes
      .slice(
        index % activeMilkTypes.length,
        (index % activeMilkTypes.length) + milkTypeCount,
      )
      .map((milkType, milkIndex) => ({
        milkTypeId: milkType.id,
        isDefault: milkIndex === 0,
      }));

    const createdByUser = users[index % users.length];
    const updatedByUser = users[(index + 1) % users.length];
    if (!createdByUser || !updatedByUser) {
      throw new Error("User seed data is required to create customers");
    }

    const createdById = createdByUser.id;
    const updatedById = updatedByUser.id;

    const customer = await prisma.customer.create({
      data: {
        fullName,
        searchName: normalizeSearchName(fullName),
        mobileNumber,
        address: "Rajkot",
        depositAmount,
        status: isArchived ? "archived" : "active",
        milkTypes: customerMilkTypes,
        notes:
          index % 5 === 0
            ? "Prefers evening delivery"
            : index === 2
              ? "Uses buffalo and cow milk"
              : "",
        archivedAt: isArchived ? d(2026, 5, 1) : null,
        createdAt: d(2026, index < 12 ? 0 : 1, (index % 28) + 1),
        updatedAt: d(2026, 5, (index % 10) + 1),
        createdById,
        updatedById,
      },
    });

    customers.push({
      id: customer.id,
      fullName: customer.fullName,
      mobileNumber: customer.mobileNumber,
      address: customer.address,
      depositAmount: customer.depositAmount,
      status: customer.status,
      milkTypes: customer.milkTypes as Array<{
        milkTypeId: string;
        isDefault: boolean;
      }>,
    });
  }

  const assignments: SeedAssignment[] = [];
  for (let index = 0; index < 30; index += 1) {
    const customer = customers[index];
    const card = cards[index];
    const assignedByUser = users[index % users.length];

    if (!customer || !card || !assignedByUser) {
      throw new Error(
        "Customer, card, and user seed data are required to create assignments",
      );
    }

    const assignedById = assignedByUser.id;

    const assignment = await prisma.cardAssignment.create({
      data: {
        cardId: card.id,
        customerId: customer.id,
        assignedAt: d(2026, 0, 10 + index),
        unassignedAt: null,
        depositAtAssignment: customer?.depositAmount ?? 0,
        assignedById,
      },
    });

    assignments.push({
      id: assignment.id,
      cardId: assignment.cardId,
      customerId: assignment.customerId,
      assignedAt: assignment.assignedAt,
      unassignedAt: assignment.unassignedAt,
    });

    await prisma.card.update({
      where: { id: card.id },
      data: {
        status: "assigned",
      },
    });
  }

  // Historical reuse assignments for archived customers.
  for (let index = 40; index < 45; index += 1) {
    const customer = customers[index];
    const card = cards[index - 40];

    if (!customer || !card) {
      throw new Error(
        "Customer and card seed data are required to create historical reuse assignments",
      );
    }

    const assignedBy = users[(index - 40) % users.length];
    if (!assignedBy) {
      throw new Error(
        "User seed data is required to create historical reuse assignments",
      );
    }

    await prisma.cardAssignment.create({
      data: {
        cardId: card.id,
        customerId: customer.id,
        assignedAt: d(2025, index - 40, 1),
        unassignedAt: d(2025, index - 40 + 6, 1),
        depositAtAssignment: customer.depositAmount,
        assignedById: assignedBy.id,
      },
    });
  }

  const dailyLedgers: Array<{
    id: string;
    customerId: string;
    cardAssignmentId: string;
    ledgerDate: Date;
    entries: Array<{
      createdAt: Date;
      createdById: string;
      milkEntries: ReturnType<typeof makeMilkEntry>[];
      productEntries: ReturnType<typeof makeProductEntry>[];
      notes: string;
      totalAmount: number;
    }>;
    updatedById: string;
  }> = [];

  for (let index = 0; index < 30; index += 1) {
    const customer = customers[index];
    const assignment = assignments[index];
    const creator = users[(index + 3) % users.length];
    if (!customer || !assignment || !creator) {
      throw new Error(
        "Customer, assignment, and user seed data are required to create daily ledgers",
      );
    }

    const creatorId = creator.id;
    const ledgerDate = d(2026, 5, (index % 28) + 1);

    let entries:
      | Array<{
          createdAt: Date;
          createdById: string;
          milkEntries: ReturnType<typeof makeMilkEntry>[];
          productEntries: ReturnType<typeof makeProductEntry>[];
          notes: string;
          totalAmount: number;
        }>
      | undefined;

    if (index === 0) {
      const milk0 = activeMilkTypes[0];
      const product0 = activeProducts[0];
      const product1 = activeProducts[1];
      if (!milk0 || !product0 || !product1) {
        throw new Error("Required milk types and products are not available");
      }
      entries = [
        {
          createdAt: d(2026, 5, 1, 8, 15),
          createdById: creatorId,
          milkEntries: [makeMilkEntry(milk0, 2)],
          productEntries: [],
          notes: "",
          totalAmount: money(2 * milk0.rate),
        },
        {
          createdAt: d(2026, 5, 1, 13, 10),
          createdById: creatorId,
          milkEntries: [],
          productEntries: [makeProductEntry(product0, 1, 35)],
          notes: "",
          totalAmount: 35,
        },
        {
          createdAt: d(2026, 5, 1, 20, 0),
          createdById: creatorId,
          milkEntries: [],
          productEntries: [makeProductEntry(product1, 1, 80)],
          notes: "",
          totalAmount: 80,
        },
        {
          createdAt: d(2026, 5, 1, 21, 0),
          createdById: creatorId,
          milkEntries: [],
          productEntries: [makeProductEntry(product0, 1, 35)],
          notes: "",
          totalAmount: 35,
        },
      ];
    } else if (index === 2) {
      const milk0 = activeMilkTypes[0];
      const milk3 = activeMilkTypes[3];
      const product2 = activeProducts[2];
      if (!milk0 || !milk3 || !product2) {
        throw new Error("Required milk types and products are not available");
      }
      entries = [
        {
          createdAt: d(2026, 5, 2, 8, 0),
          createdById: creatorId,
          milkEntries: [makeMilkEntry(milk0, 1.5), makeMilkEntry(milk3, 1)],
          productEntries: [],
          notes: "Mixed milk purchase",
          totalAmount: money(1.5 * milk0.rate + 1 * milk3.rate),
        },
        {
          createdAt: d(2026, 5, 2, 18, 30),
          createdById: creatorId,
          milkEntries: [],
          productEntries: [makeProductEntry(product2, 2, 18)],
          notes: "",
          totalAmount: 36,
        },
      ];
    } else {
      const milkA = activeMilkTypes[index % activeMilkTypes.length];
      const milkB = activeMilkTypes[(index + 1) % activeMilkTypes.length];
      const productA = activeProducts[index % activeProducts.length];
      const productB = activeProducts[(index + 3) % activeProducts.length];

      if (!milkA || !milkB || !productA || !productB) {
        throw new Error("Required milk types and products are not available");
      }

      entries = [
        {
          createdAt: d(2026, 5, (index % 28) + 1, 8, 0),
          createdById: creatorId,
          milkEntries: [makeMilkEntry(milkA, 1 + (index % 3) * 0.5)],
          productEntries: [],
          notes: "",
          totalAmount: money((1 + (index % 3) * 0.5) * milkA.rate),
        },
        {
          createdAt: d(2026, 5, (index % 28) + 1, 13, 15),
          createdById: creatorId,
          milkEntries: [],
          productEntries: [
            makeProductEntry(productA, 1 + (index % 2), 20 + (index % 5) * 5),
          ],
          notes: "",
          totalAmount: money((1 + (index % 2)) * (20 + (index % 5) * 5)),
        },
        {
          createdAt: d(2026, 5, (index % 28) + 1, 20, 0),
          createdById: creatorId,
          milkEntries: index % 2 === 0 ? [makeMilkEntry(milkB, 1)] : [],
          productEntries:
            index % 2 === 0
              ? [makeProductEntry(productB, 1, 30 + (index % 4) * 10)]
              : [],
          notes: "",
          totalAmount:
            index % 2 === 0 ? money(milkB.rate + (30 + (index % 4) * 10)) : 0,
        },
      ].filter(
        (entry) =>
          entry.totalAmount > 0 ||
          entry.milkEntries.length > 0 ||
          entry.productEntries.length > 0,
      );
    }

    const ledger = await prisma.dailyLedger.create({
      data: {
        customerId: customer.id,
        cardAssignmentId: assignment.id,
        ledgerDate,
        entries: entries.map((entry) => ({
          createdAt: entry.createdAt,
          createdById: entry.createdById,
          milkEntries: entry.milkEntries,
          productEntries: entry.productEntries,
          notes: entry.notes,
          totalAmount: entry.totalAmount,
        })),
        updatedAt: ledgerDate,
        updatedById: creatorId,
      },
    });

    dailyLedgers.push({
      id: ledger.id,
      customerId: ledger.customerId,
      cardAssignmentId: ledger.cardAssignmentId,
      ledgerDate: ledger.ledgerDate,
      entries: ledger.entries as unknown as typeof entries,
      updatedById: ledger.updatedById,
    });
  }

  const bills: Array<{
    id: string;
    billNumber: string;
    customerId: string;
    cardAssignmentId: string;
    month: number;
    year: number;
    billDate: Date;
    totalMilkLitres: number;
    milkSummary: ReturnType<typeof aggregateMilkSummary>;
    totalItemsCount: number;
    otherItems: ReturnType<typeof aggregateProductSummary>;
    otherItemsTotal: number;
    previousDue: number;
    grandTotal: number;
    totalPaid: number;
    outstandingAmount: number;
    status: "paid" | "partial" | "unpaid";
    generatedAt: Date;
    generatedById: string;
  }> = [];

  for (let index = 0; index < 30; index += 1) {
    const customer = customers[index];
    const assignment = assignments[index];
    const ledger = dailyLedgers[index];

    if (!customer || !ledger || !assignment) continue;

    const milkSummary = aggregateMilkSummary(ledger.entries);
    const otherItems = aggregateProductSummary(ledger.entries);

    const totalMilkLitres = sum(milkSummary.map((item) => item.litres));
    const otherItemsTotal = sum(otherItems.map((item) => item.amount));
    const totalItemsCount = otherItems.reduce(
      (acc, item) => acc + item.quantity,
      0,
    );
    const previousDue = index % 4 === 0 ? 500 : 0;
    const grandTotal = money(
      totalMilkLitres * 0 +
        sum(milkSummary.map((item) => item.amount)) +
        otherItemsTotal +
        previousDue,
    );

    let status: "paid" | "partial" | "unpaid";
    if (index % 3 === 0) {
      status = "paid";
    } else if (index % 3 === 1) {
      status = "partial";
    } else {
      status = "unpaid";
    }

    const totalPaid =
      status === "paid"
        ? grandTotal
        : status === "partial"
          ? money(grandTotal * 0.6)
          : 0;

    const outstandingAmount = money(grandTotal - totalPaid);

    const generatedByUser = users[(index + 1) % users.length];
    if (!generatedByUser) continue;

    const bill = await prisma.bill.create({
      data: {
        billNumber: `BILL-${String(index + 1).padStart(3, "0")}-06-2026`,
        customerId: customer.id,
        cardAssignmentId: assignment.id,
        month: 6,
        year: 2026,
        billDate: d(2026, 5, 30),
        totalMilkLitres,
        milkSummary,
        totalItemsCount,
        otherItems,
        otherItemsTotal,
        previousDue,
        grandTotal,
        totalPaid,
        outstandingAmount,
        status,
        notes: `Generated from ${billMonthLabel(6, 2026)} ledger entries`,
        generatedAt: d(2026, 5, 30, 10, 30),
        generatedById: generatedByUser.id,
      },
    });

    bills.push({
      id: bill.id,
      billNumber: bill.billNumber,
      customerId: bill.customerId,
      cardAssignmentId: bill.cardAssignmentId,
      month: bill.month,
      year: bill.year,
      billDate: bill.billDate,
      totalMilkLitres: bill.totalMilkLitres,
      milkSummary: bill.milkSummary as unknown as ReturnType<
        typeof aggregateMilkSummary
      >,
      totalItemsCount: bill.totalItemsCount,
      otherItems: bill.otherItems as unknown as ReturnType<
        typeof aggregateProductSummary
      >,
      otherItemsTotal: bill.otherItemsTotal,
      previousDue: bill.previousDue,
      grandTotal: bill.grandTotal,
      totalPaid: bill.totalPaid,
      outstandingAmount: bill.outstandingAmount,
      status: bill.status,
      generatedAt: bill.generatedAt,
      generatedById: bill.generatedById,
    });
  }

  const getUserId = (index: number): string => users[index % users.length]!.id;

  const payments: Array<{
    id: string;
    customerId: string;
    billId: string;
    amount: number;
    paymentMethod: "cash" | "upi";
    referenceNumber: string;
    notes: string;
    receivedAt: Date;
    receivedById: string;
  }> = [];

  for (let index = 0; index < bills.length; index += 1) {
    const bill = bills[index];

    if (!bill || bill.totalPaid <= 0) {
      continue;
    }

    const paymentMethod = index % 2 === 0 ? "cash" : "upi";
    const referenceNumber =
      paymentMethod === "upi"
        ? `UPI-${String(index + 1).padStart(4, "0")}`
        : "";

    const payment = await prisma.payment.create({
      data: {
        customerId: bill.customerId,
        billId: bill.id,
        billMonth: bill.month,
        billYear: bill.year,
        clientRequestId: `seed-payment-${index + 1}`,
        amount: bill.totalPaid,
        paymentMethod,
        referenceNumber,
        receiptNumber: `REC-${String(index + 1).padStart(6, "0")}`,
        notes:
          paymentMethod === "upi" && referenceNumber
            ? `UPI Ref ${referenceNumber}`
            : `Bill payment for ${billMonthLabel(bill.month, bill.year)}`,
        receivedAt: d(2026, 5, 30, 19, 30 - (index % 5)),
        receivedById: getUserId(index + 2),
        editedAt: index % 5 === 0 ? d(2026, 5, 31, 11, 0) : null,
        editedById: index % 5 === 0 ? getUserId(0) : null,
      },
    });

    payments.push({
      id: payment.id,
      customerId: payment.customerId,
      billId: payment.billId,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      referenceNumber: payment.referenceNumber,
      notes: payment.notes,
      receivedAt: payment.receivedAt,
      receivedById: payment.receivedById,
    });
  }

  const auditLogsToCreate = [];

  // Customer lifecycle logs
  for (let index = 0; index < 10; index += 1) {
    const customer = customers[index]!;
    const customerCreatedBy = getUserId(index);
    const currentPayment = payments.find(
      (payment) => payment.customerId === customer.id,
    );
    const currentBill = bills.find((bill) => bill.customerId === customer.id);
    const currentAssignment = assignments.find(
      (assignment) => assignment.customerId === customer.id,
    );

    auditLogsToCreate.push({
      customerId: customer.id,
      type: "customer_created" as const,
      title: "Customer Created",
      details: [
        { field: "Customer", oldValue: "", newValue: customer.fullName },
        { field: "Card", oldValue: "", newValue: `Card ${index + 1}` },
      ],
      performedById: customerCreatedBy,
      performedAt: d(2024, 2, 12 + index, 10, 15),
      relatedEntityType: "cardAssignment" as const,
      relatedEntityId: currentAssignment?.id ?? null,
    });

    auditLogsToCreate.push({
      customerId: customer.id,
      type: "customer_updated" as const,
      title: "Customer Updated",
      details: [
        {
          field: "Mobile",
          oldValue: `987650000${index + 1}`,
          newValue: customer.mobileNumber,
        },
        { field: "Address", oldValue: "", newValue: customer.address },
      ],
      performedById: users[(index + 1) % users.length]!.id,
      performedAt: d(2026, 5, 12, 10, 30 + index),
    });

    auditLogsToCreate.push({
      customerId: customer.id,
      type: "milk_type_changed" as const,
      title: "Milk Type Changed",
      details: [
        {
          field: "Primary Milk",
          oldValue: "Buffalo 54",
          newValue: index === 2 ? "Buffalo 54 + Cow 58" : "Buffalo 58",
        },
      ],
      performedById: users[(index + 2) % users.length]!.id,
      performedAt: d(2026, 5, 10, 20, 15 + index),
    });

    auditLogsToCreate.push({
      customerId: customer.id,
      type: "deposit_updated" as const,
      title: "Deposit Updated",
      details: [
        {
          field: "Deposit Amount",
          oldValue: "₹1,500.00",
          newValue: `₹${customer.depositAmount.toFixed(2)}`,
        },
      ],
      performedById: users[(index + 3) % users.length]!.id,
      performedAt: d(2026, 5, 5, 19, 45 + index),
    });

    auditLogsToCreate.push({
      customerId: customer.id,
      type: "note_added" as const,
      title: "Note Added",
      details: [
        {
          field: "Note",
          oldValue: "",
          newValue:
            index % 2 === 0
              ? "Prefers evening delivery"
              : "Morning delivery requested",
        },
      ],
      performedById: users[(index + 4) % users.length]!.id,
      performedAt: d(2026, 5, 28, 18, 5 + index),
    });

    if (currentAssignment) {
      auditLogsToCreate.push({
        customerId: customer.id,
        type: "card_assigned" as const,
        title: "Card Assigned",
        details: [
          {
            field: "Card Number",
            oldValue: "",
            newValue: String(index + 1),
          },
        ],
        performedById: users[(index + 1) % users.length]!.id,
        performedAt: d(2026, 0, 10 + index, 9, 0),
        relatedEntityType: "cardAssignment" as const,
        relatedEntityId: currentAssignment.id,
      });
    }

    if (currentBill) {
      auditLogsToCreate.push({
        customerId: customer.id,
        type: "bill_generated" as const,
        title: "Bill Generated",
        details: [
          { field: "Bill", oldValue: "", newValue: currentBill.billNumber },
          {
            field: "Grand Total",
            oldValue: "",
            newValue: `₹${currentBill.grandTotal.toFixed(2)}`,
          },
        ],
        performedById: users[(index + 2) % users.length]!.id,
        performedAt: d(2026, 5, 30, 23, 10 + index),
        relatedEntityType: "bill" as const,
        relatedEntityId: currentBill.id,
      });
    }

    if (currentPayment) {
      auditLogsToCreate.push({
        customerId: customer.id,
        type: "payment_added" as const,
        title: "Payment Added",
        details: [
          {
            field: "Amount",
            oldValue: "",
            newValue: `₹${currentPayment.amount.toFixed(2)}`,
          },
          {
            field: "Mode",
            oldValue: "",
            newValue: currentPayment.paymentMethod.toUpperCase(),
          },
          {
            field: "Reference",
            oldValue: "",
            newValue: currentPayment.referenceNumber || "—",
          },
        ],
        performedById: users[(index + 3) % users.length]!.id,
        performedAt: d(2026, 5, 30, 19, 30 + index),
        relatedEntityType: "payment" as const,
        relatedEntityId: currentPayment.id,
      });
    }
  }

  // A few closure/reopen examples for archived customers.
  for (let index = 40; index < 44; index += 1) {
    const customer = customers[index];
    if (!customer) {
      continue;
    }

    auditLogsToCreate.push({
      customerId: customer.id,
      type: "customer_closed" as const,
      title: "Customer Closed",
      details: [{ field: "Status", oldValue: "active", newValue: "archived" }],
      performedById: users[(index - 40) % users.length]!.id,
      performedAt: d(2026, 5, 1, 12, 0),
    });

    auditLogsToCreate.push({
      customerId: customer.id,
      type: "customer_reopened" as const,
      title: "Customer Reopened",
      details: [{ field: "Status", oldValue: "archived", newValue: "active" }],
      performedById: users[(index - 39) % users.length]!.id,
      performedAt: d(2026, 5, 20, 12, 0),
    });
  }

  for (const auditLog of auditLogsToCreate) {
    await prisma.auditLog.create({
      data: {
        customerId: auditLog.customerId,
        type: auditLog.type,
        title: auditLog.title,
        details: auditLog.details,
        performedById: auditLog.performedById,
        performedAt: auditLog.performedAt,
        relatedEntityType: auditLog.relatedEntityType ?? null,
        relatedEntityId: auditLog.relatedEntityId ?? null,
      },
    });
  }

  console.log("Seed completed successfully.");
  console.log(`Users: ${users.length}`);
  console.log(`Milk types: ${milkTypes.length}`);
  console.log(`Product suggestions: ${products.length}`);
  console.log(`Cards: ${cards.length}`);
  console.log(`Customers: ${customers.length}`);
  console.log(`Card assignments: ${assignments.length}`);
  console.log(`Daily ledgers: ${dailyLedgers.length}`);
  console.log(`Bills: ${bills.length}`);
  console.log(`Payments: ${payments.length}`);
  console.log(`Audit logs: ${auditLogsToCreate.length}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
