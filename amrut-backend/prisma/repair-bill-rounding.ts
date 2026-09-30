/**
 * Repairs bills that were priced by adding up each day's rounded amount.
 *
 * A day's milk was stored in whole rupees, so 0.75 L at Rs 54 was kept as 41 rather than
 * 40.50. Adding 28 of those billed 1,148 for 21 litres worth 1,134. This re-prices every
 * affected bill from its own ledgers, the way generation does now, and carries the
 * correction down any chain the balance was carried along.
 *
 *   npm run repair:bill-rounding -- --db <name>           # dry run, changes nothing
 *   npm run repair:bill-rounding -- --db <name> --apply   # writes, after a backup
 *
 * It only ever RE-PRICES a bill. Ledger entries, payments, receipts and customers are
 * never touched, and a bill whose correction is larger than rounding could explain is
 * reported and skipped rather than guessed at.
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { PrismaClient } from "../generated/prisma/client";
import { summariseLedgersForBill } from "../src/modules/bills/bill.service";
import { AUDIT_FIELD, moneyChange } from "../src/modules/audit/audit.util";

const APPLY = process.argv.includes("--apply");
const dbFlag = process.argv.indexOf("--db");
const INTENDED = dbFlag >= 0 ? process.argv[dbFlag + 1] : undefined;

// Limit the run to particular cards, so a correction can be checked on one customer
// before the rest of the book is touched:  --card 32 --card 117
const CARDS = process.argv
  .flatMap((arg, index) => (arg === "--card" ? [process.argv[index + 1]] : []))
  .flatMap((value) => (value ?? "").split(","))
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0);

// Puts a backup file back, exactly as it was, if anything about a run looks wrong.
const restoreFlag = process.argv.indexOf("--restore");
const RESTORE_FILE = restoreFlag >= 0 ? process.argv[restoreFlag + 1] : undefined;

function databaseName(url: string): string | null {
  const match = url.match(/\/([^/?]+)(\?|$)/);
  return match?.[1] ?? null;
}

const url = process.env.DATABASE_URL ?? "";
const actual = databaseName(url);

if (!actual) throw new Error("DATABASE_URL does not name a database.");

if (!INTENDED) {
  throw new Error(
    `Name the database to confirm the target:\n  npm run repair:bill-rounding -- --db ${actual}`,
  );
}

if (INTENDED !== actual) {
  throw new Error(`You named "${INTENDED}" but DATABASE_URL points at "${actual}".`);
}

const prisma = new PrismaClient();
const rupees = (n: number) => `Rs ${n.toLocaleString("en-IN")}`;

// Restoring is its own job: put the saved values back and stop.
if (RESTORE_FILE) {
  const saved = JSON.parse(readFileSync(RESTORE_FILE, "utf8")) as Record<string, unknown>[];

  console.log(`restoring ${saved.length} bills into ${actual} from ${RESTORE_FILE}
`);

  for (const bill of saved) {
    await prisma.bill.update({
      where: { id: bill.id as string },
      data: {
        milkSummary: bill.milkSummary as never,
        otherItems: bill.otherItems as never,
        totalMilkLitres: bill.totalMilkLitres as number,
        otherItemsTotal: bill.otherItemsTotal as number,
        totalItemsCount: bill.totalItemsCount as number,
        previousDue: bill.previousDue as number,
        grandTotal: bill.grandTotal as number,
        outstandingAmount: bill.outstandingAmount as number,
        carriedForwardAmount: bill.carriedForwardAmount as number,
        status: bill.status as never,
        billVersion: bill.billVersion as number,
      },
    });

    console.log(`  ${String(bill.billNumber)} restored to ${rupees(bill.grandTotal as number)}`);
  }

  console.log(`
restored ${saved.length} bills.`);
  await prisma.$disconnect();
  process.exit(0);
}

// Cards name customers; a customer's bills are what gets re-priced.
let onlyCustomerIds: string[] | null = null;

if (CARDS.length) {
  const assignments = await prisma.cardAssignment.findMany({
    where: { card: { cardNumber: { in: CARDS } } },
    select: { customerId: true, card: { select: { cardNumber: true } } },
  });

  onlyCustomerIds = [...new Set(assignments.map((a) => a.customerId))];

  console.log(
    `limited to card(s) ${CARDS.join(", ")} -> ${onlyCustomerIds.length} customer(s)
`,
  );

  if (!onlyCustomerIds.length) {
    throw new Error(`No customer has ever held card ${CARDS.join(", ")}.`);
  }
}

type Row = {
  id: string;
  billNumber: string;
  customerId: string;
  month: number;
  year: number;
  previousDue: number;
  grandTotal: number;
  totalPaid: number;
  outstandingAmount: number;
  carriedForwardAmount: number;
  carriedForwardToBillId: string | null;
  isOpeningBalance: boolean;
  billVersion: number;
  status: string;
  generatedById: string;
};

const bills = (await prisma.bill.findMany({
  ...(onlyCustomerIds ? { where: { customerId: { in: onlyCustomerIds } } } : {}),
  orderBy: [{ customerId: "asc" }, { year: "asc" }, { month: "asc" }],
})) as unknown as Row[];

console.log(`${actual}: ${bills.length} bills\n`);

const byCustomer = new Map<string, Row[]>();

for (const bill of bills) {
  byCustomer.set(bill.customerId, [...(byCustomer.get(bill.customerId) ?? []), bill]);
}

type Change = {
  bill: Row;
  newPreviousDue: number;
  newGrandTotal: number;
  newOutstanding: number;
  newCarriedForward: number;
  newStatus: string;
  summary: ReturnType<typeof summariseLedgersForBill> | null;
};

const changes: Change[] = [];
const skipped: string[] = [];

for (const list of byCustomer.values()) {
  // Corrections travel forwards: re-pricing an earlier bill changes what it carried on.
  const inbound = new Map<string, number>();

  for (const bill of list) {
    const carriedIn = inbound.get(bill.id) ?? 0;
    const oldCharges = bill.grandTotal - bill.previousDue;

    let newCharges = oldCharges;
    let summary: ReturnType<typeof summariseLedgersForBill> | null = null;

    if (!bill.isOpeningBalance) {
      const monthStart = new Date(Date.UTC(bill.year, bill.month - 1, 1));
      const monthEnd = new Date(Date.UTC(bill.year, bill.month, 1));

      const ledgers = await prisma.dailyLedger.findMany({
        where: {
          customerId: bill.customerId,
          ledgerDate: { gte: monthStart, lt: monthEnd },
        },
        orderBy: { ledgerDate: "asc" },
      });

      summary = summariseLedgersForBill(ledgers);
      newCharges = summary.currentCharges;

      // Rounding can only ever be off by half a rupee per entry. Anything larger is a
      // different story — entries added or removed since the bill was made — and is
      // reported rather than guessed at.
      const entryCount = ledgers.reduce(
        (count, ledger) => count + ((ledger.entries ?? []) as unknown[]).length,
        0,
      );

      const drift = Math.abs(newCharges - oldCharges);

      if (drift > entryCount * 0.5 + 1) {
        skipped.push(
          `${bill.billNumber}: charges ${rupees(oldCharges)} -> ${rupees(newCharges)}, ` +
            `off by ${rupees(drift)} across ${entryCount} entries — more than rounding explains, left untouched`,
        );
        continue;
      }
    }

    const newPreviousDue = bill.previousDue + carriedIn;
    const newGrandTotal = newCharges + newPreviousDue;

    let newOutstanding = bill.outstandingAmount;
    let newCarriedForward = bill.carriedForwardAmount;
    let newStatus = bill.status;

    if (bill.carriedForwardToBillId) {
      // This bill's balance already moved on; correct the amount that moved and pass
      // the difference to the bill that received it.
      newCarriedForward = Math.max(0, newGrandTotal - bill.totalPaid);

      inbound.set(
        bill.carriedForwardToBillId,
        (inbound.get(bill.carriedForwardToBillId) ?? 0) +
          (newCarriedForward - bill.carriedForwardAmount),
      );
    } else {
      newOutstanding = Math.max(0, newGrandTotal - bill.totalPaid);
      newStatus = newOutstanding === 0 ? "paid" : bill.totalPaid > 0 ? "partial" : "unpaid";
    }

    const unchanged =
      newGrandTotal === bill.grandTotal &&
      newPreviousDue === bill.previousDue &&
      newOutstanding === bill.outstandingAmount &&
      newCarriedForward === bill.carriedForwardAmount;

    if (unchanged) continue;

    changes.push({
      bill,
      newPreviousDue,
      newGrandTotal,
      newOutstanding,
      newCarriedForward,
      newStatus,
      summary,
    });
  }
}

for (const change of changes) {
  const bill = change.bill;

  console.log(
    `${bill.billNumber.padEnd(18)} total ${rupees(bill.grandTotal).padStart(12)} -> ${rupees(change.newGrandTotal).padStart(12)}` +
      `   outstanding ${rupees(bill.outstandingAmount).padStart(11)} -> ${rupees(change.newOutstanding).padStart(11)}` +
      `   (${rupees(change.newGrandTotal - bill.grandTotal)})`,
  );
}

const overcharged = changes.reduce(
  (sum, change) => sum + Math.max(0, change.bill.grandTotal - change.newGrandTotal),
  0,
);

console.log(`\nbills to re-price:    ${changes.length}`);
console.log(`overcharged in total: ${rupees(overcharged)}`);

if (skipped.length) {
  console.log(`\nleft untouched for review (${skipped.length}):`);
  for (const line of skipped) console.log("  " + line);
}

if (!APPLY) {
  console.log("\nDry run — nothing was written. Re-run with --apply to save these.");
  await prisma.$disconnect();
  process.exit(0);
}

if (changes.length) {
  mkdirSync("backups", { recursive: true });

  const file = `backups/bills-before-rounding-repair-${actual}-${Date.now()}.json`;

  writeFileSync(
    file,
    JSON.stringify(
      changes.map((change) => change.bill),
      null,
      2,
    ),
  );

  console.log(`\nbacked up ${changes.length} bills to ${file}`);
}

for (const change of changes) {
  const bill = change.bill;

  await prisma.$transaction(async (tx) => {
    await tx.bill.update({
      where: { id: bill.id },
      data: {
        ...(change.summary
          ? {
              milkSummary: change.summary.milkSummary as never,
              otherItems: change.summary.otherItems as never,
              totalMilkLitres: change.summary.totalMilkLitres,
              otherItemsTotal: change.summary.otherItemsTotal,
              totalItemsCount: change.summary.totalItemsCount,
            }
          : {}),
        previousDue: change.newPreviousDue,
        grandTotal: change.newGrandTotal,
        outstandingAmount: change.newOutstanding,
        carriedForwardAmount: change.newCarriedForward,
        status: change.newStatus as never,
        billVersion: (bill.billVersion ?? 1) + 1,
      },
    });

    await tx.auditLog.create({
      data: {
        customerId: bill.customerId,
        type: "bill_updated",
        title: `Bill ${bill.billNumber} re-priced: daily rounding corrected`,
        details: [
          moneyChange(AUDIT_FIELD.billTotal, bill.grandTotal, change.newGrandTotal),
        ] as never,
        // Attributed to whoever generated the bill; a repair has no operator of its own.
        performedById: bill.generatedById,
        relatedEntityType: "bill",
        relatedEntityId: bill.id,
      },
    });
  });
}

console.log(`\napplied to ${changes.length} bills.`);

await prisma.$disconnect();
