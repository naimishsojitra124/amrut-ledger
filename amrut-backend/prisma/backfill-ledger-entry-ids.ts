import "dotenv/config";
import { MongoClient } from "mongodb";
import type { Db } from "mongodb";
import { nanoid } from "nanoid";

/**
 * Gives every existing daily-ledger entry a stable id.
 *
 * Entries used to be addressed by their position in the array. That is unsafe
 * the moment two devices are open on the same customer and day: if one removes
 * an entry, the other's "edit entry 2" now points at a different row than the
 * one its user selected. The API addresses entries by id instead, so the rows
 * already in the database need one.
 *
 * Run once per environment, before deploying the new backend. Entries that
 * already have an id are left alone, so re-running is harmless.
 *
 *   npm run prisma:backfill-entry-ids
 *   npm run prisma:backfill-entry-ids -- --dry-run
 */

const DRY_RUN = process.argv.includes("--dry-run");

interface LedgerDocument {
  _id: unknown;
  entries?: { id?: string }[];
}

async function backfill(db: Db) {
  const collection = db.collection<LedgerDocument>("daily_ledgers");

  // Only ledgers holding at least one entry without a usable id.
  const needsId = {
    entries: { $elemMatch: { $or: [{ id: { $exists: false } }, { id: "" }] } },
  };

  const pending = await collection.countDocuments(needsId);

  if (pending === 0) {
    console.log("Every ledger entry already has an id. Nothing to do.");
    return;
  }

  if (DRY_RUN) {
    console.log(`[dry-run] ${pending} ledger(s) contain entries needing an id.`);
    return;
  }

  console.log(`Backfilling ids across ${pending} ledger(s)...`);

  let ledgersUpdated = 0;
  let entriesUpdated = 0;

  const cursor = collection.find(needsId);

  // One document at a time: ids must be unique per entry, so this cannot be
  // expressed as a single aggregation-pipeline update.
  for await (const ledger of cursor) {
    const entries = (ledger.entries ?? []).map((entry) => {
      if (entry.id) return entry;

      entriesUpdated += 1;
      return { ...entry, id: nanoid(12) };
    });

    await collection.updateOne({ _id: ledger._id }, { $set: { entries } });
    ledgersUpdated += 1;
  }

  console.log(`Done. ${entriesUpdated} entr(ies) across ${ledgersUpdated} ledger(s) updated.`);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  const client = new MongoClient(databaseUrl);

  try {
    await client.connect();
    await backfill(client.db());
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exitCode = 1;
});
