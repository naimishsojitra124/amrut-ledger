/**
 * Trims ledger-entry audit rows for months that are closed and settled.
 *
 * Audit rows are the second largest collection in this database and nearly nine in ten of
 * them record a single ledger entry being added or edited. That trail earns its keep while
 * a month is being keyed in and queried — "who changed this day, and to what" — and stops
 * earning it once the month's bill has been generated and paid in full. The ledger entries
 * themselves are never touched, so a bill can still be re-derived from them at any time.
 *
 *   npm run prune:audit-logs -- --db <name>                   # dry run, changes nothing
 *   npm run prune:audit-logs -- --db <name> --apply           # writes, after a backup
 *   npm run prune:audit-logs -- --db <name> --months 18       # keep more than the default
 *   npm run prune:audit-logs -- --db <name> --restore <file>  # put a pruned run back
 *
 * Only `entry_added`, `entry_updated` and `entry_deleted` are ever removed. Every row about
 * money or identity — bills, payments, deposits, opening balances, cards, customers — is
 * kept for good, whatever its age. A month is skipped unless EVERY bill in it is settled,
 * so an unpaid or partly paid month keeps its full trail no matter how old it is.
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { PrismaClient } from "../generated/prisma/client";

const APPLY = process.argv.includes("--apply");

function flag(name: string): string | undefined {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

const INTENDED = flag("--db");
const RESTORE_FILE = flag("--restore");

// Entry rows younger than this are always kept, even if their month is settled. Twelve
// months covers a full year of "what did we charge them last winter" questions.
const KEEP_MONTHS = Number(flag("--months") ?? 12);

const PRUNABLE = ["entry_added", "entry_updated", "entry_deleted"] as const;

function databaseName(url: string): string | null {
  return url.match(/\/([^/?]+)(\?|$)/)?.[1] ?? null;
}

const url = process.env.DATABASE_URL ?? "";
const actual = databaseName(url);

if (!actual) throw new Error("DATABASE_URL does not name a database.");

if (!INTENDED) {
  throw new Error(
    `Name the database to confirm the target:\n  npm run prune:audit-logs -- --db ${actual}`,
  );
}

if (INTENDED !== actual) {
  throw new Error(`You named "${INTENDED}" but DATABASE_URL points at "${actual}".`);
}

if (!Number.isFinite(KEEP_MONTHS) || KEEP_MONTHS < 1) {
  throw new Error(`--months must be a positive number, got "${flag("--months")}".`);
}

const prisma = new PrismaClient();

// Restoring is its own job: put the saved rows back and stop.
if (RESTORE_FILE) {
  const saved = JSON.parse(readFileSync(RESTORE_FILE, "utf8")) as Record<string, unknown>[];

  console.log(`restoring ${saved.length} audit rows into ${actual} from ${RESTORE_FILE}\n`);

  let restored = 0;
  for (const row of saved) {
    // An id that is already back in place means a half-finished restore is being repeated.
    const exists = await prisma.auditLog.findUnique({ where: { id: row.id as string } });
    if (exists) continue;

    await prisma.auditLog.create({
      data: {
        id: row.id as string,
        customerId: row.customerId as string,
        type: row.type as never,
        title: row.title as string,
        details: row.details as never,
        performedById: row.performedById as string,
        performedAt: new Date(row.performedAt as string),
        relatedEntityType: (row.relatedEntityType ?? null) as never,
        relatedEntityId: (row.relatedEntityId ?? null) as string | null,
      },
    });
    restored += 1;
  }

  console.log(`restored ${restored} row(s); ${saved.length - restored} were already present`);
  await prisma.$disconnect();
  process.exit(0);
}

// ---------------------------------------------------------------------------

const now = new Date();
const cutoff = new Date(
  Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - KEEP_MONTHS, 1),
);

console.log(`database ${actual}`);
console.log(`keeping every entry row from ${cutoff.toISOString().slice(0, 7)} onwards`);
console.log(APPLY ? "mode: APPLY\n" : "mode: dry run, nothing will be written\n");

// A month is only prunable when all of its bills are settled. `carried_forward` counts as
// settled: the balance moved onto a later bill, which keeps its own trail.
const bills = await prisma.bill.findMany({
  select: { month: true, year: true, status: true },
});

const monthState = new Map<string, { total: number; open: number }>();
for (const bill of bills) {
  const key = `${bill.year}-${String(bill.month).padStart(2, "0")}`;
  const state = monthState.get(key) ?? { total: 0, open: 0 };
  state.total += 1;
  if (bill.status === "unpaid" || bill.status === "partial") state.open += 1;
  monthState.set(key, state);
}

const settled = new Set(
  [...monthState].filter(([, state]) => state.open === 0).map(([key]) => key),
);

console.log("months with bills:");
for (const [key, state] of [...monthState].sort()) {
  const mark = settled.has(key) ? "settled" : `${state.open} still open`;
  console.log(`   ${key}  ${String(state.total).padStart(4)} bills   ${mark}`);
}

// Candidate rows: entry rows old enough, whose month is settled. `performedAt` is when the
// entry was keyed, which for back-dated entries can trail the ledger date by weeks — using
// it is the conservative choice, since it only ever keeps rows longer.
const candidates = await prisma.auditLog.findMany({
  where: { type: { in: PRUNABLE as never }, performedAt: { lt: cutoff } },
  orderBy: { performedAt: "asc" },
});

const doomed = candidates.filter((row) => {
  const key = `${row.performedAt.getUTCFullYear()}-${String(
    row.performedAt.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
  return settled.has(key);
});

const totalRows = await prisma.auditLog.count();

console.log(`\naudit rows in total           ${totalRows}`);
console.log(`entry rows older than cutoff  ${candidates.length}`);
console.log(`of those, in a settled month  ${doomed.length}`);

if (doomed.length === 0) {
  console.log("\nnothing to prune.");
  await prisma.$disconnect();
  process.exit(0);
}

const bytes = doomed.reduce((sum, row) => sum + JSON.stringify(row).length, 0);
console.log(`roughly ${(bytes / 1e6).toFixed(2)} MB of documents\n`);

if (!APPLY) {
  console.log("dry run: nothing was written. Re-run with --apply to prune.");
  await prisma.$disconnect();
  process.exit(0);
}

mkdirSync("backups", { recursive: true });
const backup = `backups/pruned-audit-${actual}-${Date.now()}.json`;
writeFileSync(backup, JSON.stringify(doomed, null, 2));
console.log(`backed up ${doomed.length} rows to ${backup}`);

const { count } = await prisma.auditLog.deleteMany({
  where: { id: { in: doomed.map((row) => row.id) } },
});

console.log(`deleted ${count} audit row(s)`);
console.log(`${totalRows - count} audit rows remain`);
console.log(`\nto undo:  npm run prune:audit-logs -- --db ${actual} --restore ${backup}`);

await prisma.$disconnect();
