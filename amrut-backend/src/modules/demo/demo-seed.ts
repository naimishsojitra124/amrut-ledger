import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { nanoid } from "nanoid";

import type { PrismaClient } from "../../../generated/prisma/client";

/**
 * The demo dataset: a dairy with about three months of trading behind it.
 *
 * One definition, two callers — `npm run seed` for a local database, and the
 * scheduled reset that keeps the public demo from drifting. Keeping them on the
 * same data means the demo always looks like what a developer sees locally.
 *
 * Two things this has to get right, both learned the hard way:
 *
 *   1. **Every collection is dropped, including the ones added later.** Prisma
 *      refuses to delete a row another model still points at, so a collection
 *      missing from the wipe does not merely survive — it aborts the whole
 *      seed. Anything added to the schema must be added to `wipe()` too.
 *
 *   2. **Dates are relative to today, never hard-coded.** The demo is rebuilt
 *      every few hours and is expected to look like a shop that is open for
 *      business. A dataset pinned to a fixed month goes quiet the moment the
 *      calendar moves past it: today's ledger is empty, the current bills page
 *      is empty, and a reviewer concludes the app is broken.
 *
 * Only ever safe against a database that exists to be thrown away.
 */

const SALT_ROUNDS = 12;
const BUSINESS_TIME_ZONE = "Asia/Kolkata";

/**
 * The shared account the demo publishes on its login screen.
 *
 * Its credentials are printed for everyone to use, so they have to survive
 * every rebuild unchanged.
 */
export const DEMO_ACCOUNT = {
  fullName: "Guest Reviewer",
  mobileNumber: "0000000000",
  email: "guest@demo.local",
} as const;

/**
 * When the demo data was last rebuilt.
 *
 * Kept in its own collection rather than derived from the data, because the
 * demo host sleeps when idle: a plain interval timer simply stops, whereas a
 * stored timestamp still reads as stale on the first request after it wakes.
 *
 * The collection is deliberately outside the Prisma schema — it describes the
 * demo, not the shop — so it is read and written with raw commands.
 */
const STATE_COLLECTION = "demo_state";
const STATE_ID = "demo";

export async function readLastDemoReset(prisma: PrismaClient): Promise<Date | null> {
  const result = (await prisma.$runCommandRaw({
    find: STATE_COLLECTION,
    filter: { _id: STATE_ID },
    limit: 1,
  })) as { cursor?: { firstBatch?: { lastResetAt?: { $date?: string } | Date }[] } };

  const row = result.cursor?.firstBatch?.[0];
  if (!row?.lastResetAt) return null;

  const raw = row.lastResetAt;
  const value = raw instanceof Date ? raw : new Date(raw.$date ?? "");

  return Number.isNaN(value.getTime()) ? null : value;
}

/**
 * Records that the demo has just been rebuilt.
 *
 * Called by the CLI seed as well as the scheduler: without it, seeding a demo
 * database by hand leaves an old timestamp behind, and the running server
 * wipes the freshly seeded data at its next check.
 */
export async function markDemoReset(prisma: PrismaClient, at = new Date()): Promise<void> {
  await prisma.$runCommandRaw({
    update: STATE_COLLECTION,
    updates: [
      {
        q: { _id: STATE_ID },
        u: { $set: { lastResetAt: { $date: at.toISOString() } } },
        upsert: true,
      },
    ],
  });
}

/**
 * Creates the guest account.
 *
 * Separate from `seedDatabase` because the two have different lifetimes: the
 * dataset is thrown away and rebuilt, while the account has to exist whenever
 * the demo is running, including on a database that was seeded by hand.
 */
export async function createDemoAccount(
  prisma: PrismaClient,
  password: string,
  saltRounds: number = SALT_ROUNDS,
): Promise<void> {
  await prisma.user.create({
    data: {
      fullName: DEMO_ACCOUNT.fullName,
      mobileNumber: DEMO_ACCOUNT.mobileNumber,
      email: DEMO_ACCOUNT.email,
      passwordHash: await bcrypt.hash(password, saltRounds),
      role: "guest",
      status: "active",
    },
  });
}

/** Rows per `createMany`. Keeps individual round trips small on a slow link. */
const CHUNK_SIZE = 200;

export interface SeedOptions {
  prisma: PrismaClient;
  /** Shared by every seeded account. */
  password: string;
  /** Defaults to silence; the CLI passes `console.log`. */
  log?: (message: string) => void;
}

export interface SeedSummary {
  users: number;
  milkTypes: number;
  products: number;
  cards: number;
  customers: number;
  assignments: number;
  depositTransactions: number;
  dailyLedgers: number;
  ledgerEntries: number;
  bills: number;
  payments: number;
  functionOrders: number;
  auditLogs: number;
}

// ── Identifiers ────────────────────────────────────────────────────────────
//
// Ids are generated up front rather than read back from each insert, so whole
// collections can go in with one `createMany` instead of a round trip per row.
// On the demo host a round trip costs roughly half a second, and the old
// row-at-a-time seed needed several hundred of them.

const OBJECT_ID_MACHINE = randomBytes(5).toString("hex");
let objectIdCounter = Math.floor(Math.random() * 0xff_ff_ff);

/** A syntactically valid MongoDB ObjectId: 4-byte time, 5 random, 3 counter. */
function objectId(): string {
  objectIdCounter = (objectIdCounter + 1) % 0x100_00_00;

  return (
    Math.floor(Date.now() / 1000)
      .toString(16)
      .padStart(8, "0") +
    OBJECT_ID_MACHINE +
    objectIdCounter.toString(16).padStart(6, "0")
  );
}

// ── Randomness ─────────────────────────────────────────────────────────────

/**
 * Seeded generator, so a rebuild produces the same shop with new dates.
 *
 * Reproducibility matters here: when someone says "the demo shows a negative
 * balance on card 12", card 12 should still look the same after a reset.
 */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

// ── Dates ──────────────────────────────────────────────────────────────────
//
// The app stores a business date as UTC midnight of the Asia/Kolkata calendar
// day (see `dateStringToBusinessDate`). Seeded dates have to be built the same
// way, or they land on the previous day and fall outside the month their bill
// is generated for.

const DAY_MS = 24 * 60 * 60 * 1000;

/** The IST calendar day containing `instant`, as UTC midnight. */
function businessDay(instant: Date): Date {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
  }).format(instant);

  return new Date(`${iso}T00:00:00.000Z`);
}

function addDays(day: Date, days: number): Date {
  return new Date(day.getTime() + days * DAY_MS);
}

function startOfMonth(day: Date, monthsFromNow = 0): Date {
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + monthsFromNow, 1));
}

/** Last day of the month, matching how the app writes `billDate`. */
function endOfMonth(month: number, year: number): Date {
  return new Date(Date.UTC(year, month, 0));
}

function dueDateFor(month: number, year: number): Date {
  return new Date(Date.UTC(year, month, 10));
}

function periodOf(day: Date): { month: number; year: number } {
  return { month: day.getUTCMonth() + 1, year: day.getUTCFullYear() };
}

/**
 * A wall-clock IST moment on a business day, expressed as the instant it
 * really was — 08:00 in the shop is 02:30 UTC.
 */
function atIst(day: Date, hour: number, minute = 0): Date {
  return new Date(day.getTime() + (hour * 60 + minute - 330) * 60_000);
}

function monthLabel(month: number, year: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// ── Money and quantities ───────────────────────────────────────────────────

/** Money is stored in whole rupees; an `Int` column rejects 142.5 outright. */
function money(value: number): number {
  return Math.round(value);
}

/** Litres stay fractional — 2.5 L is an ordinary quantity. */
function litres(value: number): number {
  return Math.round(value * 100) / 100;
}

function sumMoney(values: number[]): number {
  return money(values.reduce((total, value) => total + value, 0));
}

/** Matches how the running app writes money into an audit log. */
function formatSeedMoney(value: number): string {
  return `Rs. ${Math.round(value).toLocaleString("en-IN")}`;
}

function normalizeSearchName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function pick<T>(items: readonly T[], index: number): T {
  return items[((index % items.length) + items.length) % items.length]!;
}

// ── Bulk insert ────────────────────────────────────────────────────────────

async function insertAll<T>(rows: T[], write: (data: T[]) => Promise<unknown>): Promise<number> {
  for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
    await write(rows.slice(index, index + CHUNK_SIZE));
  }

  return rows.length;
}

// ── Static tables ──────────────────────────────────────────────────────────

const USER_SEED = [
  { fullName: "Naimish Sojitra", mobileNumber: "9876543210", email: "user1@gmail.com", role: "owner" as const, status: "active" as const },
  { fullName: "Ashvinbhai Sojitra", mobileNumber: "9876543211", email: "user2@gmail.com", role: "manager" as const, status: "active" as const },
  { fullName: "Harsh Sojitra", mobileNumber: "9876543212", email: "user3@gmail.com", role: "manager" as const, status: "active" as const },
  { fullName: "Raj Patel", mobileNumber: "9876543213", email: "user4@gmail.com", role: "employee" as const, status: "active" as const },
  { fullName: "Milan Joshi", mobileNumber: "9876543214", email: "user5@gmail.com", role: "employee" as const, status: "inactive" as const },
];

const MILK_TYPE_SEED = [
  { name: "Buffalo 54", rate: 54, shortCode: "BUF54", status: "active" as const },
  { name: "Buffalo 58", rate: 58, shortCode: "BUF58", status: "active" as const },
  { name: "Buffalo 64", rate: 64, shortCode: "BUF64", status: "active" as const },
  { name: "Cow 58", rate: 58, shortCode: "COW58", status: "active" as const },
  { name: "Buffalo 50", rate: 50, shortCode: "BUF50", status: "inactive" as const },
  { name: "Buffalo 54", rate: 54, shortCode: "BUF54-OLD", status: "inactive" as const },
  { name: "Buffalo 60", rate: 60, shortCode: "BUF60", status: "inactive" as const },
  { name: "Cow 54", rate: 54, shortCode: "COW54", status: "inactive" as const },
];

/** Prices are the seed's own: `ProductSuggestion` only stores the name. */
const PRODUCT_SEED = [
  { name: "Bread", price: 40 },
  { name: "Butter", price: 60 },
  { name: "Cheese", price: 120 },
  { name: "Toast", price: 45 },
  { name: "Chocolate", price: 30 },
  { name: "Biscuit", price: 20 },
  { name: "Chaas", price: 18 },
  { name: "Paneer", price: 90 },
  { name: "Khari", price: 50 },
  { name: "Pav", price: 35 },
  { name: "Wafer", price: 25 },
  { name: "Dahi", price: 40 },
  { name: "Shri Khand", price: 110 },
  { name: "Basundi", price: 130 },
  { name: "Ghorvu", price: 70 },
  { name: "Milkshake", price: 55 },
  { name: "Sweet Corn", price: 45 },
  { name: "Namkeen", price: 65 },
  { name: "Cookies", price: 75 },
  { name: "Ghee", price: 320 },
];

const CUSTOMER_NAMES = [
  "Naimish Patel", "Mahesh Patel", "Rakesh Joshi", "Ketan Shah", "Priya Mehta",
  "Dhruv Trivedi", "Falguni Desai", "Hitesh Vaghela", "Jignesh Parmar", "Kinjal Bhatt",
  "Lalit Chauhan", "Manisha Dave", "Nirav Gohil", "Pooja Solanki", "Rajesh Thakkar",
  "Sandhya Rathod", "Tushar Makwana", "Urvashi Pandya", "Vipul Barot", "Yogesh Ganatra",
  "Alpa Modi", "Bhavesh Kotak", "Chetna Amin", "Darshan Vyas", "Ekta Raval",
  "Gaurav Zaveri", "Harsha Nanavati", "Ishan Dholakia", "Jayshree Purohit", "Kaushik Tanna",
  "Leena Acharya", "Mitesh Sanghvi", "Nisha Bhavsar", "Omkar Jadeja", "Parul Doshi",
  "Ronak Kansara", "Sejal Gandhi", "Tarun Oza", "Varsha Limbachiya", "Zalak Mistry",
];

const ADDRESSES = [
  "Kalawad Road, Rajkot",
  "University Road, Rajkot",
  "Gondal Road, Rajkot",
  "Mavdi Chowkdi, Rajkot",
  "Nana Mava Road, Rajkot",
  "Raiya Road, Rajkot",
  "Yagnik Road, Rajkot",
];

const CUSTOMER_NOTES = [
  "",
  "Prefers evening delivery",
  "Leave at the gate",
  "Calls ahead on Sundays",
  "",
  "Pays on the first of the month",
];

/** How many customers hold a card, and therefore have a ledger and bills. */
const CARDED_CUSTOMERS = 30;
/** Active, but waiting on a card — shows the unassigned state in the UI. */
const UNCARDED_CUSTOMERS = 4;
const ARCHIVED_CUSTOMERS = 6;
const TOTAL_CUSTOMERS = CARDED_CUSTOMERS + UNCARDED_CUSTOMERS + ARCHIVED_CUSTOMERS;
const TOTAL_CARDS = 45;

// ── Row shapes built in memory before insertion ────────────────────────────

interface SeedUser {
  id: string;
  fullName: string;
}

interface SeedMilkType {
  id: string;
  name: string;
  rate: number;
}

interface SeedProduct {
  id: string;
  name: string;
  price: number;
}

interface SeedCustomer {
  id: string;
  index: number;
  fullName: string;
  depositAmount: number;
  cardId: string | null;
  cardNumber: number | null;
  assignmentId: string | null;
  milkTypeIds: string[];
  createdAt: Date;
  createdById: string;
}

interface LedgerMilkEntry {
  milkTypeId: string;
  milkTypeName: string;
  rate: number;
  litres: number;
  amount: number;
}

interface LedgerProductEntry {
  productSuggestionId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface LedgerEntry {
  id: string;
  createdAt: Date;
  createdById: string;
  clientRequestId: string;
  milkEntries: LedgerMilkEntry[];
  productEntries: LedgerProductEntry[];
  notes: string;
  totalAmount: number;
}

interface SeedLedger {
  id: string;
  customerId: string;
  cardAssignmentId: string;
  ledgerDate: Date;
  entries: LedgerEntry[];
  createdAt: Date;
  updatedAt: Date;
  updatedById: string;
}

interface SeedBill {
  id: string;
  billNumber: string;
  customerId: string;
  cardAssignmentId: string;
  month: number;
  year: number;
  billDate: Date;
  dueDate: Date;
  totalMilkLitres: number;
  milkSummary: Array<{
    milkTypeId: string;
    milkTypeName: string;
    litres: number;
    rate: number;
    amount: number;
  }>;
  totalItemsCount: number;
  otherItems: Array<{
    productSuggestionId: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  otherItemsTotal: number;
  previousDue: number;
  grandTotal: number;
  totalPaid: number;
  outstandingAmount: number;
  status: "paid" | "partial" | "unpaid" | "carried_forward";
  carriedForwardAmount: number;
  carriedForwardToBillId: string | null;
  isOpeningBalance: boolean;
  notes: string;
  billVersion: number;
  generatedAt: Date;
  generatedById: string;
}

interface SeedPayment {
  id: string;
  customerId: string;
  billId: string;
  billMonth: number;
  billYear: number;
  receiptNumber: string;
  clientRequestId: string;
  amount: number;
  depositUsed: number;
  paymentMethod: "cash" | "upi";
  referenceNumber: string;
  notes: string;
  receivedAt: Date;
  receivedById: string;
  editedAt: Date | null;
  editedById: string | null;
  reversedAt: Date | null;
  reversalReason: string;
  reversedById: string | null;
}

/** Mirrors the `AuditLogType` enum; kept local so the seed reads on its own. */
type SeedAuditLogType =
  | "customer_created"
  | "customer_updated"
  | "customer_closed"
  | "customer_reopened"
  | "card_assigned"
  | "card_unassigned"
  | "milk_type_changed"
  | "deposit_updated"
  | "entry_added"
  | "entry_updated"
  | "entry_deleted"
  | "bill_generated"
  | "opening_balance_set"
  | "opening_balance_removed"
  | "payment_added"
  | "payment_reversed"
  | "note_added";

interface SeedAuditLog {
  customerId: string;
  type: SeedAuditLogType;
  title: string;
  details: Array<{ field: string; oldValue: string; newValue: string }>;
  performedById: string;
  performedAt: Date;
  relatedEntityType?: "ledger" | "bill" | "payment" | "card" | "cardAssignment";
  relatedEntityId?: string;
}

// ── Wipe ───────────────────────────────────────────────────────────────────

/**
 * Empties every collection, children before parents.
 *
 * Prisma enforces required relations even on MongoDB, so deleting users while
 * an `AuthSession` still points at one fails with P2014 and takes the whole
 * seed down with it. Sessions and deposit transactions are the two that are
 * easy to forget, because nothing in this file creates them directly.
 */
async function wipe(prisma: PrismaClient): Promise<void> {
  await prisma.authSession.deleteMany();
  await prisma.functionOrderAuditLog.deleteMany();
  await prisma.functionOrder.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.dailyLedger.deleteMany();
  await prisma.depositTransaction.deleteMany();
  await prisma.cardAssignment.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.card.deleteMany();
  await prisma.productSuggestion.deleteMany();
  await prisma.milkType.deleteMany();
  await prisma.user.deleteMany();
  await prisma.counter.deleteMany();
}

// ── Seed ───────────────────────────────────────────────────────────────────

export async function seedDatabase(options: SeedOptions): Promise<SeedSummary> {
  const { prisma, password } = options;
  const log = options.log ?? (() => {});
  const random = makeRandom(20_260_920);

  await wipe(prisma);

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const today = businessDay(new Date());
  const thisMonthStart = startOfMonth(today);
  const lastMonthStart = startOfMonth(today, -1);
  const twoMonthsAgoStart = startOfMonth(today, -2);

  /** The shop has been on the system since a little before the oldest bill. */
  const openedOn = addDays(twoMonthsAgoStart, -20);

  // ── Users ────────────────────────────────────────────────────────────────

  const users: SeedUser[] = USER_SEED.map((seed) => ({
    id: objectId(),
    fullName: seed.fullName,
  }));

  const userRows = USER_SEED.map((seed, index) => ({
    id: users[index]!.id,
    fullName: seed.fullName,
    mobileNumber: seed.mobileNumber,
    email: seed.email,
    passwordHash,
    refreshTokenHash: null,
    role: seed.role,
    status: seed.status,
    lastLoginAt: seed.status === "active" ? atIst(addDays(today, -1), 8 + index, 15) : atIst(addDays(today, -40), 17, 20),
    failedLoginAttempts: 0,
    lockUntil: null,
    createdAt: openedOn,
    updatedAt: addDays(today, -7),
  }));

  const owner = users[0]!;
  const staff = users.filter((_, index) => USER_SEED[index]!.status === "active");

  /** Spreads authorship around, so audit logs are not all by one person. */
  const actor = (index: number): string => pick(staff, index).id;

  // ── Catalogue ────────────────────────────────────────────────────────────

  const milkTypes: SeedMilkType[] = MILK_TYPE_SEED.map((seed) => ({
    id: objectId(),
    name: seed.name,
    rate: seed.rate,
  }));

  const milkTypeRows = MILK_TYPE_SEED.map((seed, index) => ({
    id: milkTypes[index]!.id,
    name: seed.name,
    rate: seed.rate,
    shortCode: seed.shortCode,
    status: seed.status,
    createdAt: openedOn,
    updatedAt: openedOn,
  }));

  const activeMilkTypes = milkTypes.filter(
    (_, index) => MILK_TYPE_SEED[index]!.status === "active",
  );

  const products: SeedProduct[] = PRODUCT_SEED.map((seed) => ({
    id: objectId(),
    name: seed.name,
    price: seed.price,
  }));

  const productRows = PRODUCT_SEED.map((seed, index) => ({
    id: products[index]!.id,
    name: seed.name,
    displayOrder: index + 1,
    status: "active" as const,
    createdAt: openedOn,
    updatedAt: openedOn,
  }));

  const cardIds = Array.from({ length: TOTAL_CARDS }, () => objectId());

  const cardRows = cardIds.map((id, index) => ({
    id,
    cardNumber: index + 1,
    status: index < CARDED_CUSTOMERS ? ("assigned" as const) : ("available" as const),
    createdAt: openedOn,
  }));

  // ── Customers, cards and deposits ────────────────────────────────────────

  const customers: SeedCustomer[] = [];
  const customerRows = [];
  const assignmentRows = [];
  const depositRows = [];
  const auditLogs: SeedAuditLog[] = [];

  for (let index = 0; index < TOTAL_CUSTOMERS; index += 1) {
    const id = objectId();
    const fullName = pick(CUSTOMER_NAMES, index);
    const isCarded = index < CARDED_CUSTOMERS;
    const isArchived = index >= CARDED_CUSTOMERS + UNCARDED_CUSTOMERS;

    // Deposits are taken in round figures; a couple of customers have none.
    const depositAmount = index % 11 === 0 ? 0 : pick([1000, 1500, 2000, 2500, 3000], index);

    const milkTypeCount = index % 6 === 0 ? 2 : 1;
    const customerMilkTypes = Array.from({ length: milkTypeCount }, (_, offset) => ({
      milkTypeId: pick(activeMilkTypes, index + offset).id,
      isDefault: offset === 0,
    }));

    const createdAt = addDays(openedOn, Math.floor(random() * 15));
    const createdById = actor(index);
    const cardId = isCarded ? cardIds[index]! : null;
    const assignmentId = isCarded ? objectId() : null;

    customerRows.push({
      id,
      fullName,
      searchName: normalizeSearchName(fullName),
      mobileNumber: `98765${String(40_000 + index).padStart(5, "0")}`,
      address: pick(ADDRESSES, index),
      depositAmount,
      status: isArchived ? ("archived" as const) : ("active" as const),
      milkTypes: customerMilkTypes,
      notes: pick(CUSTOMER_NOTES, index),
      archivedAt: isArchived ? addDays(today, -30 + (index % 5)) : null,
      createdAt,
      updatedAt: addDays(today, -(index % 12)),
      createdById,
      updatedById: actor(index + 1),
    });

    customers.push({
      id,
      index,
      fullName,
      depositAmount,
      cardId,
      cardNumber: isCarded ? index + 1 : null,
      assignmentId,
      milkTypeIds: customerMilkTypes.map((entry) => entry.milkTypeId),
      createdAt,
      createdById,
    });

    auditLogs.push({
      customerId: id,
      type: "customer_created",
      title: `${fullName} added`,
      details: [
        { field: "Name", oldValue: "", newValue: fullName },
        { field: "Address", oldValue: "", newValue: pick(ADDRESSES, index) },
      ],
      performedById: createdById,
      performedAt: atIst(createdAt, 10, 15),
    });

    if (isCarded && assignmentId && cardId) {
      assignmentRows.push({
        id: assignmentId,
        cardId,
        customerId: id,
        assignedAt: createdAt,
        unassignedAt: null,
        depositAtAssignment: depositAmount,
        assignedById: createdById,
        createdAt,
        updatedAt: createdAt,
      });

      auditLogs.push({
        customerId: id,
        type: "card_assigned",
        title: `Card ${index + 1} assigned`,
        details: [{ field: "Card number", oldValue: "None", newValue: String(index + 1) }],
        performedById: createdById,
        performedAt: atIst(createdAt, 10, 20),
        relatedEntityType: "cardAssignment",
        relatedEntityId: assignmentId,
      });
    }

    if (depositAmount > 0) {
      // Most deposits were taken in one go; some were topped up later, and the
      // running balance has to end on the customer's current `depositAmount`.
      const toppedUpLater = index % 7 === 3 && depositAmount >= 2000;
      const initial = toppedUpLater ? depositAmount - 500 : depositAmount;

      depositRows.push({
        customerId: id,
        type: "top_up" as const,
        amount: initial,
        balanceAfter: initial,
        reference: "Customer opening deposit",
        notes: "",
        performedById: createdById,
        createdAt,
      });

      auditLogs.push({
        customerId: id,
        type: "deposit_updated",
        title: `Opening deposit of ${formatSeedMoney(initial)} recorded`,
        details: [
          { field: "Deposit balance", oldValue: formatSeedMoney(0), newValue: formatSeedMoney(initial) },
        ],
        performedById: createdById,
        performedAt: atIst(createdAt, 10, 25),
      });

      if (toppedUpLater) {
        const toppedUpOn = addDays(lastMonthStart, index % 20);

        depositRows.push({
          customerId: id,
          type: "top_up" as const,
          amount: 500,
          balanceAfter: depositAmount,
          reference: "",
          notes: "Requested a larger deposit",
          performedById: actor(index + 2),
          createdAt: atIst(toppedUpOn, 18, 30),
        });

        auditLogs.push({
          customerId: id,
          type: "deposit_updated",
          title: `Deposit topped up by ${formatSeedMoney(500)}`,
          details: [
            { field: "Deposit", oldValue: formatSeedMoney(0), newValue: formatSeedMoney(500) },
            {
              field: "Deposit balance",
              oldValue: formatSeedMoney(initial),
              newValue: formatSeedMoney(depositAmount),
            },
          ],
          performedById: actor(index + 2),
          performedAt: atIst(toppedUpOn, 18, 30),
        });
      }
    }

    if (isArchived) {
      auditLogs.push({
        customerId: id,
        type: "customer_closed",
        title: `${fullName} closed`,
        details: [{ field: "Status", oldValue: "active", newValue: "archived" }],
        performedById: owner.id,
        performedAt: atIst(addDays(today, -30 + (index % 5)), 12, 0),
      });
    }
  }

  const cardedCustomers = customers.filter((customer) => customer.assignmentId !== null);

  // ── Daily ledgers ────────────────────────────────────────────────────────
  //
  // Three months up to and including today, so the current month's ledger and
  // today's quick entry both have something in them.

  const ledgers: SeedLedger[] = [];
  let ledgerEntryCount = 0;

  for (const customer of cardedCustomers) {
    // A few customers joined part way through, so the list is not uniform.
    const startedOn =
      customer.index >= CARDED_CUSTOMERS - 4
        ? addDays(lastMonthStart, 6 + (customer.index % 5))
        : twoMonthsAgoStart;

    const primaryMilk =
      milkTypes.find((milkType) => milkType.id === customer.milkTypeIds[0]) ?? activeMilkTypes[0]!;
    const secondaryMilk = customer.milkTypeIds[1]
      ? milkTypes.find((milkType) => milkType.id === customer.milkTypeIds[1])
      : undefined;

    for (let day = startedOn; day <= today; day = addDays(day, 1)) {
      // Everyone takes the occasional day off.
      if (random() < 0.08) continue;

      const entries: LedgerEntry[] = [];
      const recordedById = actor(customer.index + day.getUTCDate());

      const morningLitres = litres(pick([0.5, 1, 1, 1.5, 2, 2, 2.5, 3], customer.index + day.getUTCDate()));
      const morningMilk: LedgerMilkEntry = {
        milkTypeId: primaryMilk.id,
        milkTypeName: primaryMilk.name,
        rate: primaryMilk.rate,
        litres: morningLitres,
        amount: money(morningLitres * primaryMilk.rate),
      };

      entries.push({
        id: nanoid(12),
        createdAt: atIst(day, 7, 30 + (customer.index % 25)),
        createdById: recordedById,
        clientRequestId: "",
        milkEntries: [morningMilk],
        productEntries: [],
        notes: "",
        totalAmount: morningMilk.amount,
      });

      if (secondaryMilk && random() < 0.35) {
        const eveningLitres = litres(pick([0.5, 1, 1.5], customer.index + day.getUTCDate()));
        const eveningMilk: LedgerMilkEntry = {
          milkTypeId: secondaryMilk.id,
          milkTypeName: secondaryMilk.name,
          rate: secondaryMilk.rate,
          litres: eveningLitres,
          amount: money(eveningLitres * secondaryMilk.rate),
        };

        entries.push({
          id: nanoid(12),
          createdAt: atIst(day, 19, 10 + (customer.index % 20)),
          createdById: recordedById,
          clientRequestId: "",
          milkEntries: [eveningMilk],
          productEntries: [],
          notes: "",
          totalAmount: eveningMilk.amount,
        });
      }

      if (random() < 0.28) {
        const product = pick(products, customer.index + day.getUTCDate() * 3);
        const quantity = random() < 0.25 ? 2 : 1;

        const productEntry: LedgerProductEntry = {
          productSuggestionId: product.id,
          itemName: product.name,
          quantity,
          unitPrice: product.price,
          amount: money(quantity * product.price),
        };

        entries.push({
          id: nanoid(12),
          createdAt: atIst(day, 13, 5 + (customer.index % 30)),
          createdById: recordedById,
          clientRequestId: "",
          milkEntries: [],
          productEntries: [productEntry],
          notes: random() < 0.1 ? "Collected from the counter" : "",
          totalAmount: productEntry.amount,
        });
      }

      ledgerEntryCount += entries.length;

      ledgers.push({
        id: objectId(),
        customerId: customer.id,
        cardAssignmentId: customer.assignmentId!,
        ledgerDate: day,
        entries,
        createdAt: entries[0]!.createdAt,
        updatedAt: entries[entries.length - 1]!.createdAt,
        updatedById: recordedById,
      });
    }
  }

  // A handful of recent entries show up in the customer's audit trail.
  for (const ledger of ledgers.filter((row) => row.ledgerDate >= addDays(today, -3))) {
    const entry = ledger.entries[0]!;
    const milk = entry.milkEntries[0];

    auditLogs.push({
      customerId: ledger.customerId,
      type: "entry_added",
      title: "Entry added",
      details: [
        {
          field: "Entry",
          oldValue: "",
          newValue: milk
            ? `${milk.litres} L ${milk.milkTypeName} at ${formatSeedMoney(milk.rate)}/L = ${formatSeedMoney(milk.amount)} (total ${formatSeedMoney(entry.totalAmount)})`
            : `(total ${formatSeedMoney(entry.totalAmount)})`,
        },
      ],
      performedById: entry.createdById,
      performedAt: entry.createdAt,
      relatedEntityType: "ledger",
      relatedEntityId: ledger.id,
    });
  }

  // ── Bills ────────────────────────────────────────────────────────────────
  //
  // The two completed months are billed. The current month deliberately is
  // not, so a reviewer can generate this month's bills themselves and watch it
  // work against real ledger data.

  const bills: SeedBill[] = [];
  const payments: SeedPayment[] = [];

  /** Still-open balance per customer, rolled into the next bill generated. */
  const openBalances = new Map<string, { billId: string; amount: number }>();

  // Two customers were already owed money when the shop moved onto the system.
  const openingBalanceCustomers = cardedCustomers.slice(0, 2);
  const openingPeriod = periodOf(startOfMonth(today, -3));

  for (const customer of openingBalanceCustomers) {
    const amount = customer.index === 0 ? 1850 : 940;
    const id = objectId();

    bills.push({
      id,
      billNumber: `OPEN-${String(openingPeriod.month).padStart(2, "0")}-${openingPeriod.year}-${customer.cardNumber}`,
      customerId: customer.id,
      cardAssignmentId: customer.assignmentId!,
      month: openingPeriod.month,
      year: openingPeriod.year,
      billDate: endOfMonth(openingPeriod.month, openingPeriod.year),
      dueDate: dueDateFor(openingPeriod.month, openingPeriod.year),
      totalMilkLitres: 0,
      milkSummary: [],
      totalItemsCount: 0,
      otherItems: [],
      otherItemsTotal: 0,
      previousDue: amount,
      grandTotal: amount,
      totalPaid: 0,
      outstandingAmount: amount,
      status: "unpaid",
      carriedForwardAmount: 0,
      carriedForwardToBillId: null,
      isOpeningBalance: true,
      notes: "Balance brought over from the paper book",
      billVersion: 1,
      generatedAt: atIst(openedOn, 11, 0),
      generatedById: owner.id,
    });

    openBalances.set(customer.id, { billId: id, amount });

    auditLogs.push({
      customerId: customer.id,
      type: "opening_balance_set",
      title: `Opening balance of ${formatSeedMoney(amount)} recorded`,
      details: [
        { field: "Outstanding", oldValue: formatSeedMoney(0), newValue: formatSeedMoney(amount) },
        {
          field: "Billing period",
          oldValue: "",
          newValue: monthLabel(openingPeriod.month, openingPeriod.year),
        },
      ],
      performedById: owner.id,
      performedAt: atIst(openedOn, 11, 0),
      relatedEntityType: "bill",
      relatedEntityId: id,
    });
  }

  let receiptSequence = 0;
  let paymentSequence = 0;

  for (const monthStart of [twoMonthsAgoStart, lastMonthStart]) {
    const { month, year } = periodOf(monthStart);
    const monthEnd = endOfMonth(month, year);
    const isMostRecent = monthStart.getTime() === lastMonthStart.getTime();

    for (const customer of cardedCustomers) {
      const monthLedgers = ledgers.filter(
        (ledger) =>
          ledger.customerId === customer.id &&
          ledger.ledgerDate >= monthStart &&
          ledger.ledgerDate <= monthEnd,
      );

      if (monthLedgers.length === 0) continue;

      // Aggregate the month's entries the same way `generateBill` does.
      const milkMap = new Map<string, SeedBill["milkSummary"][number]>();
      const itemMap = new Map<string, SeedBill["otherItems"][number]>();

      for (const ledger of monthLedgers) {
        for (const entry of ledger.entries) {
          for (const milk of entry.milkEntries) {
            const existing = milkMap.get(milk.milkTypeId);

            if (existing) {
              existing.litres = litres(existing.litres + milk.litres);
              existing.amount = money(existing.amount + milk.amount);
            } else {
              milkMap.set(milk.milkTypeId, {
                milkTypeId: milk.milkTypeId,
                milkTypeName: milk.milkTypeName,
                litres: milk.litres,
                rate: milk.rate,
                amount: milk.amount,
              });
            }
          }

          for (const item of entry.productEntries) {
            const key = `${item.productSuggestionId}|${item.unitPrice}`;
            const existing = itemMap.get(key);

            if (existing) {
              existing.quantity += item.quantity;
              existing.amount = money(existing.amount + item.amount);
            } else {
              itemMap.set(key, { ...item });
            }
          }
        }
      }

      const milkSummary = [...milkMap.values()];
      const otherItems = [...itemMap.values()];
      const totalMilkLitres = litres(
        milkSummary.reduce((total, item) => total + item.litres, 0),
      );
      const otherItemsTotal = sumMoney(otherItems.map((item) => item.amount));
      const totalItemsCount = otherItems.reduce((total, item) => total + item.quantity, 0);

      // Anything still open from an earlier bill moves onto this one, and out
      // of the earlier bill's outstanding, so the same debt is never counted
      // twice across bills.
      const carried = openBalances.get(customer.id);
      const previousDue = carried?.amount ?? 0;

      const id = objectId();

      if (carried) {
        const earlier = bills.find((bill) => bill.id === carried.billId)!;

        earlier.carriedForwardAmount = carried.amount;
        earlier.carriedForwardToBillId = id;
        earlier.outstandingAmount = 0;
        earlier.status = "carried_forward";

        openBalances.delete(customer.id);
      }

      const grandTotal = money(
        sumMoney(milkSummary.map((item) => item.amount)) + otherItemsTotal + previousDue,
      );

      // Most bills get settled; the most recent month leaves more open, so the
      // dashboard has pending bills and a real outstanding figure.
      const roll = random();
      const status: "paid" | "partial" | "unpaid" = isMostRecent
        ? roll < 0.45
          ? "paid"
          : roll < 0.7
            ? "partial"
            : "unpaid"
        : roll < 0.75
          ? "paid"
          : roll < 0.88
            ? "partial"
            : "unpaid";

      const totalPaid =
        status === "paid" ? grandTotal : status === "partial" ? money(grandTotal * 0.6) : 0;
      const outstandingAmount = money(grandTotal - totalPaid);

      const generatedAt = atIst(monthEnd, 21, 30);
      const generatedById = actor(customer.index + 1);

      bills.push({
        id,
        billNumber: `BILL-${String(month).padStart(2, "0")}-${year}-${customer.cardNumber}`,
        customerId: customer.id,
        cardAssignmentId: customer.assignmentId!,
        month,
        year,
        billDate: monthEnd,
        dueDate: dueDateFor(month, year),
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
        carriedForwardAmount: 0,
        carriedForwardToBillId: null,
        isOpeningBalance: false,
        notes: `Generated from ${monthLabel(month, year)} ledger entries`,
        billVersion: 1,
        generatedAt,
        generatedById,
      });

      auditLogs.push({
        customerId: customer.id,
        type: "bill_generated",
        title: `Bill ${`BILL-${String(month).padStart(2, "0")}-${year}-${customer.cardNumber}`} generated for ${monthLabel(month, year)}`,
        details: [
          { field: "Bill total", oldValue: "", newValue: formatSeedMoney(grandTotal) },
          ...(previousDue > 0
            ? [
                {
                  field: "Previous dues carried forward",
                  oldValue: "",
                  newValue: formatSeedMoney(previousDue),
                },
              ]
            : []),
        ],
        performedById: generatedById,
        performedAt: generatedAt,
        relatedEntityType: "bill" as const,
        relatedEntityId: id,
      });

      if (outstandingAmount > 0) {
        openBalances.set(customer.id, { billId: id, amount: outstandingAmount });
      }

      if (totalPaid > 0) {
        receiptSequence += 1;
        paymentSequence += 1;

        const paidOn = addDays(monthEnd, 2 + (customer.index % 6));
        const receivedAt = atIst(paidOn, 18, 15 + (customer.index % 30));
        const paymentMethod = customer.index % 2 === 0 ? ("cash" as const) : ("upi" as const);
        const referenceNumber =
          paymentMethod === "upi" ? `UPI${String(910_000 + paymentSequence)}` : "";
        const receiptNumber = `REC-${paidOn.getUTCFullYear()}-${String(receiptSequence).padStart(4, "0")}`;
        const receivedById = actor(customer.index + 2);
        const paymentId = objectId();

        payments.push({
          id: paymentId,
          customerId: customer.id,
          billId: id,
          billMonth: month,
          billYear: year,
          receiptNumber,
          clientRequestId: `seed-payment-${paymentSequence}`,
          amount: totalPaid,
          depositUsed: 0,
          paymentMethod,
          referenceNumber,
          notes:
            status === "partial"
              ? "Part payment, balance promised next week"
              : `Bill payment for ${monthLabel(month, year)}`,
          receivedAt,
          receivedById,
          editedAt: null,
          editedById: null,
          reversedAt: null,
          reversalReason: "",
          reversedById: null,
        });

        auditLogs.push({
          customerId: customer.id,
          type: "payment_added",
          title: `Payment of ${formatSeedMoney(totalPaid)} received`,
          details: [
            { field: "Amount received", oldValue: "", newValue: formatSeedMoney(totalPaid) },
            { field: "Payment method", oldValue: "", newValue: paymentMethod.toUpperCase() },
            { field: "Receipt number", oldValue: "", newValue: receiptNumber },
          ],
          performedById: receivedById,
          performedAt: receivedAt,
          relatedEntityType: "bill",
          relatedEntityId: id,
        });
      }
    }
  }

  // One reversed payment, so the demo shows a bounced entry being backed out
  // without it counting towards what the customer has paid.
  const reversible = bills.find((bill) => bill.status === "unpaid" && !bill.isOpeningBalance);

  if (reversible) {
    receiptSequence += 1;
    paymentSequence += 1;

    const takenOn = addDays(reversible.billDate, 3);
    const reversedOn = addDays(reversible.billDate, 5);
    const amount = money(reversible.grandTotal * 0.5);
    const reversedById = owner.id;

    payments.push({
      id: objectId(),
      customerId: reversible.customerId,
      billId: reversible.id,
      billMonth: reversible.month,
      billYear: reversible.year,
      receiptNumber: `REC-${takenOn.getUTCFullYear()}-${String(receiptSequence).padStart(4, "0")}`,
      clientRequestId: `seed-payment-${paymentSequence}`,
      amount,
      depositUsed: 0,
      paymentMethod: "upi",
      referenceNumber: `UPI${String(910_000 + paymentSequence)}`,
      notes: "UPI transfer later reversed by the bank",
      receivedAt: atIst(takenOn, 19, 5),
      receivedById: actor(3),
      editedAt: null,
      editedById: null,
      reversedAt: atIst(reversedOn, 11, 40),
      reversalReason: "Bank reversed the transfer",
      reversedById,
    });

    auditLogs.push({
      customerId: reversible.customerId,
      type: "payment_reversed",
      title: `Payment of ${formatSeedMoney(amount)} reversed`,
      details: [
        { field: "Amount received", oldValue: formatSeedMoney(amount), newValue: formatSeedMoney(0) },
        { field: "Reason", oldValue: "", newValue: "Bank reversed the transfer" },
      ],
      performedById: reversedById,
      performedAt: atIst(reversedOn, 11, 40),
      relatedEntityType: "bill",
      relatedEntityId: reversible.id,
    });
  }

  // ── Receipt counters ─────────────────────────────────────────────────────
  //
  // Receipt numbers are `@unique` and the app hands them out from a counter.
  // Without this, the first payment a visitor records would be issued
  // REC-<year>-0001 again and fail on the unique index.
  const counterRows = [...new Set(payments.map((payment) => payment.receivedAt.getUTCFullYear()))].map(
    (year) => ({
      id: `receipt-${year}`,
      nextNumber:
        payments.filter((payment) => payment.receivedAt.getUTCFullYear() === year).length + 1,
    }),
  );

  // ── Function orders ──────────────────────────────────────────────────────

  const functionOrderRows = buildFunctionOrders(today, owner.id, actor(2));

  // ── A few catalogue changes worth showing in the audit trail ─────────────

  for (const customer of cardedCustomers.slice(0, 6)) {
    const changedOn = addDays(lastMonthStart, 4 + customer.index);

    auditLogs.push({
      customerId: customer.id,
      type: "milk_type_changed",
      title: "Milk types updated",
      details: [
        {
          field: "Primary milk type",
          oldValue: "Buffalo 54 at Rs. 54/L",
          newValue: `${pick(activeMilkTypes, customer.index).name} at ${formatSeedMoney(pick(activeMilkTypes, customer.index).rate)}/L`,
        },
      ],
      performedById: actor(customer.index + 2),
      performedAt: atIst(changedOn, 20, 15),
    });

    auditLogs.push({
      customerId: customer.id,
      type: "note_added",
      title: "Note added",
      details: [
        {
          field: "Notes",
          oldValue: "",
          newValue: customer.index % 2 === 0 ? "Prefers evening delivery" : "Morning delivery requested",
        },
      ],
      performedById: actor(customer.index + 4),
      performedAt: atIst(addDays(today, -(customer.index % 9) - 1), 18, 5),
    });
  }

  auditLogs.sort((left, right) => left.performedAt.getTime() - right.performedAt.getTime());

  // ── Write ────────────────────────────────────────────────────────────────

  await insertAll(userRows, (data) => prisma.user.createMany({ data }));
  await insertAll(milkTypeRows, (data) => prisma.milkType.createMany({ data }));
  await insertAll(productRows, (data) => prisma.productSuggestion.createMany({ data }));
  await insertAll(cardRows, (data) => prisma.card.createMany({ data }));
  await insertAll(customerRows, (data) => prisma.customer.createMany({ data }));
  await insertAll(assignmentRows, (data) => prisma.cardAssignment.createMany({ data }));
  await insertAll(depositRows, (data) => prisma.depositTransaction.createMany({ data }));
  await insertAll(ledgers, (data) => prisma.dailyLedger.createMany({ data }));
  await insertAll(bills, (data) => prisma.bill.createMany({ data }));
  await insertAll(payments, (data) => prisma.payment.createMany({ data }));
  await insertAll(counterRows, (data) => prisma.counter.createMany({ data }));
  await insertAll(functionOrderRows, (data) => prisma.functionOrder.createMany({ data }));
  await insertAll(auditLogs, (data) => prisma.auditLog.createMany({ data }));

  const summary: SeedSummary = {
    users: userRows.length,
    milkTypes: milkTypeRows.length,
    products: productRows.length,
    cards: cardRows.length,
    customers: customerRows.length,
    assignments: assignmentRows.length,
    depositTransactions: depositRows.length,
    dailyLedgers: ledgers.length,
    ledgerEntries: ledgerEntryCount,
    bills: bills.length,
    payments: payments.length,
    functionOrders: functionOrderRows.length,
    auditLogs: auditLogs.length,
  };

  log("Seed completed successfully.");
  log(
    `Ledger covers ${twoMonthsAgoStart.toISOString().slice(0, 10)} to ${today
      .toISOString()
      .slice(0, 10)}; bills generated for the two completed months.`,
  );

  for (const [label, count] of Object.entries(summary)) {
    log(`${label}: ${count}`);
  }

  return summary;
}

// ── Function orders ────────────────────────────────────────────────────────

/**
 * A handful of catering orders around today, so the dashboard's "Upcoming
 * Function Orders" panel is populated and the page has something to open.
 */
function buildFunctionOrders(today: Date, ownerId: string, staffId: string) {
  const { month, year } = periodOf(today);
  const prefix = `FO-${String(month).padStart(2, "0")}-${year}`;

  const item = (itemName: string, quantity: number, unit: string, unitPrice: number) => ({
    id: nanoid(12),
    itemName,
    quantity,
    unit,
    unitPrice,
    returnedQuantity: 0,
    returnNote: "",
    movements: [],
  });

  return [
    {
      orderNumber: `${prefix}-${nanoid(6).toUpperCase()}`,
      customerName: "Hitesh Vaghela",
      mobileNumber: "9825012345",
      eventName: "Engagement lunch",
      deliveryDays: [
        {
          deliveryDate: addDays(today, 4),
          deliveryTime: "09:00",
          peopleCount: 120,
          items: [item("Basundi", 15, "kg", 130), item("Paneer", 8, "kg", 90)],
          notes: "Deliver to the community hall kitchen",
        },
      ],
      reminderDaysBefore: 2,
      status: "confirmed" as const,
      notes: "Advance of Rs. 2,000 taken",
      createdById: ownerId,
      updatedById: ownerId,
      createdAt: addDays(today, -9),
      updatedAt: addDays(today, -3),
    },
    {
      orderNumber: `${prefix}-${nanoid(6).toUpperCase()}`,
      customerName: "Sejal Gandhi",
      mobileNumber: "9898765432",
      eventName: "Satyanarayan katha",
      deliveryDays: [
        {
          deliveryDate: addDays(today, 9),
          deliveryTime: "07:30",
          peopleCount: 60,
          items: [item("Shri Khand", 10, "kg", 110), item("Ghee", 3, "kg", 320)],
          notes: "",
        },
        {
          deliveryDate: addDays(today, 10),
          deliveryTime: "17:00",
          peopleCount: 60,
          items: [item("Chaas", 40, "litre", 18)],
          notes: "Evening prasad",
        },
      ],
      reminderDaysBefore: 3,
      status: "confirmed" as const,
      notes: "",
      createdById: staffId,
      updatedById: staffId,
      createdAt: addDays(today, -5),
      updatedAt: addDays(today, -2),
    },
    {
      orderNumber: `${prefix}-${nanoid(6).toUpperCase()}`,
      customerName: "Kaushik Tanna",
      mobileNumber: "9727001122",
      eventName: "Office Diwali party",
      deliveryDays: [
        {
          deliveryDate: addDays(today, 16),
          deliveryTime: "11:00",
          peopleCount: 200,
          items: [item("Milkshake", 60, "litre", 55), item("Cookies", 12, "kg", 75)],
          notes: "Quantities to be confirmed",
        },
      ],
      reminderDaysBefore: 5,
      status: "draft" as const,
      notes: "Waiting on final headcount",
      createdById: staffId,
      updatedById: staffId,
      createdAt: addDays(today, -1),
      updatedAt: addDays(today, -1),
    },
    {
      orderNumber: `${prefix}-${nanoid(6).toUpperCase()}`,
      customerName: "Parul Doshi",
      mobileNumber: "9033445566",
      eventName: "Birthday",
      deliveryDays: [
        {
          deliveryDate: addDays(today, -6),
          deliveryTime: "16:00",
          peopleCount: 40,
          items: [item("Basundi", 6, "kg", 130), item("Namkeen", 4, "kg", 65)],
          notes: "",
        },
      ],
      reminderDaysBefore: 1,
      status: "completed" as const,
      notes: "Paid in full on delivery",
      createdById: ownerId,
      updatedById: staffId,
      createdAt: addDays(today, -20),
      updatedAt: addDays(today, -6),
    },
    {
      orderNumber: `${prefix}-${nanoid(6).toUpperCase()}`,
      customerName: "Tarun Oza",
      mobileNumber: "9714778899",
      eventName: "House warming",
      deliveryDays: [
        {
          deliveryDate: addDays(today, -2),
          deliveryTime: "10:00",
          peopleCount: 75,
          items: [item("Paneer", 5, "kg", 90)],
          notes: "",
        },
      ],
      reminderDaysBefore: 2,
      status: "cancelled" as const,
      notes: "Event postponed by the family",
      createdById: staffId,
      updatedById: ownerId,
      createdAt: addDays(today, -14),
      updatedAt: addDays(today, -4),
    },
  ];
}
