import "dotenv/config";
import { MongoClient } from "mongodb";
import type { Db, Document } from "mongodb";

/**
 * One-off migration for the "money is whole rupees" change.
 *
 * Prisma reads `Int` fields strictly: a document holding `142.5` where the
 * schema says `Int` makes the query fail, so this must run once against each
 * environment before the new backend is started.
 *
 * It does three things:
 *
 *   1. Rounds every monetary field to a whole rupee, including the ones nested
 *      inside embedded arrays (ledger entries, bill summaries).
 *   2. Drops the unique index on `customers.mobileNumber`. Numbers are now
 *      optional and may legitimately repeat across a household, and the unique
 *      index also meant only one customer could exist without a number at all.
 *   3. Backfills the carry-forward fields added to `bills`.
 *
 * It is idempotent — running it twice is harmless.
 *
 *   npm run prisma:migrate-money
 *   npm run prisma:migrate-money -- --dry-run
 */

const DRY_RUN = process.argv.includes("--dry-run");

/** `$round` to 0 places, tolerating nulls and missing fields. */
function roundField(path: string) {
  return {
    $cond: [
      { $eq: [{ $type: `$${path}` }, "missing"] },
      "$$REMOVE",
      { $round: [{ $ifNull: [`$${path}`, 0] }, 0] },
    ],
  };
}

function roundFields(paths: string[]): Document {
  return Object.fromEntries(paths.map((path) => [path, roundField(path)]));
}

async function roundSimple(db: Db, collection: string, fields: string[]) {
  if (fields.length === 0) return;

  if (DRY_RUN) {
    const count = await db.collection(collection).countDocuments();
    console.log(`  [dry-run] would round ${fields.join(", ")} on ${count} ${collection}`);
    return;
  }

  const result = await db
    .collection(collection)
    .updateMany({}, [{ $set: roundFields(fields) }]);

  console.log(`  ${collection}: ${result.modifiedCount} document(s) updated`);
}

/**
 * Rounds numeric fields inside an embedded array, preserving every other
 * property on each element.
 */
async function roundEmbedded(
  db: Db,
  collection: string,
  arrayPath: string,
  fields: string[],
  nested?: { path: string; fields: string[] }[],
) {
  if (DRY_RUN) {
    console.log(`  [dry-run] would round ${arrayPath}.{${fields.join(", ")}} in ${collection}`);
    return;
  }

  const mapElement = (asVar: string) => ({
    $mergeObjects: [
      `$$${asVar}`,
      Object.fromEntries(
        fields.map((field) => [
          field,
          { $round: [{ $ifNull: [`$$${asVar}.${field}`, 0] }, 0] },
        ]),
      ),
      ...(nested ?? []).map((child) => ({
        [child.path]: {
          $map: {
            input: { $ifNull: [`$$${asVar}.${child.path}`, []] },
            as: "child",
            in: {
              $mergeObjects: [
                "$$child",
                Object.fromEntries(
                  child.fields.map((field) => [
                    field,
                    { $round: [{ $ifNull: [`$$child.${field}`, 0] }, 0] },
                  ]),
                ),
              ],
            },
          },
        },
      })),
    ],
  });

  const result = await db.collection(collection).updateMany({}, [
    {
      $set: {
        [arrayPath]: {
          $map: {
            input: { $ifNull: [`$${arrayPath}`, []] },
            as: "item",
            in: mapElement("item"),
          },
        },
      },
    },
  ]);

  console.log(`  ${collection}.${arrayPath}: ${result.modifiedCount} document(s) updated`);
}

async function dropMobileNumberUniqueIndex(db: Db) {
  const indexes = await db.collection("customers").indexes();

  const target = indexes.find(
    (index) =>
      index.unique === true &&
      index.key &&
      Object.keys(index.key).length === 1 &&
      Object.keys(index.key)[0] === "mobileNumber",
  );

  if (!target?.name) {
    console.log("  customers.mobileNumber: no unique index present (nothing to drop)");
    return;
  }

  if (DRY_RUN) {
    console.log(`  [dry-run] would drop unique index ${target.name} on customers.mobileNumber`);
    return;
  }

  await db.collection("customers").dropIndex(target.name);
  console.log(`  customers.mobileNumber: dropped unique index ${target.name}`);
}

/**
 * A blank mobile number is the same as no mobile number. Storing "" made two
 * such customers collide under the old unique index; normalising to null keeps
 * search, display and reporting consistent.
 */
async function normalizeBlankMobileNumbers(db: Db) {
  if (DRY_RUN) {
    const count = await db.collection("customers").countDocuments({ mobileNumber: "" });
    console.log(`  [dry-run] would clear ${count} blank mobile number(s)`);
    return;
  }

  const result = await db
    .collection("customers")
    .updateMany({ mobileNumber: "" }, { $set: { mobileNumber: null } });

  console.log(`  customers: ${result.modifiedCount} blank mobile number(s) cleared`);
}

async function backfillCarryForwardFields(db: Db) {
  if (DRY_RUN) {
    const count = await db
      .collection("bills")
      .countDocuments({ carriedForwardAmount: { $exists: false } });
    console.log(`  [dry-run] would backfill carry-forward fields on ${count} bill(s)`);
    return;
  }

  const result = await db
    .collection("bills")
    .updateMany(
      { carriedForwardAmount: { $exists: false } },
      { $set: { carriedForwardAmount: 0, carriedForwardToBillId: null } },
    );

  console.log(`  bills: ${result.modifiedCount} document(s) backfilled`);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  const client = new MongoClient(databaseUrl);

  try {
    await client.connect();
    const db = client.db();

    console.log(
      DRY_RUN
        ? "Dry run — no documents will be modified.\n"
        : "Migrating monetary fields to whole rupees...\n",
    );

    console.log("Rounding monetary fields:");
    await roundSimple(db, "customers", ["depositAmount"]);
    await roundSimple(db, "milk_types", ["rate"]);
    await roundSimple(db, "card_assignments", ["depositAtAssignment"]);
    await roundSimple(db, "deposit_transactions", ["amount", "balanceAfter"]);
    await roundSimple(db, "payments", ["amount", "depositUsed"]);
    await roundSimple(db, "bills", [
      "otherItemsTotal",
      "previousDue",
      "grandTotal",
      "totalPaid",
      "outstandingAmount",
    ]);

    console.log("\nRounding embedded arrays:");
    // `litres` and function-order quantities stay fractional on purpose.
    await roundEmbedded(db, "bills", "milkSummary", ["rate", "amount"]);
    await roundEmbedded(db, "bills", "otherItems", ["unitPrice", "amount"]);
    await roundEmbedded(db, "daily_ledgers", "entries", ["totalAmount"], [
      { path: "milkEntries", fields: ["rate", "amount"] },
      { path: "productEntries", fields: ["unitPrice", "amount"] },
    ]);
    await roundEmbedded(db, "function_orders", "deliveryDays", [], [
      { path: "items", fields: ["unitPrice"] },
    ]);

    console.log("\nCustomer mobile numbers:");
    await normalizeBlankMobileNumbers(db);
    await dropMobileNumberUniqueIndex(db);

    console.log("\nBill carry-forward fields:");
    await backfillCarryForwardFields(db);

    console.log(
      DRY_RUN
        ? "\nDry run complete. Re-run without --dry-run to apply."
        : "\nMigration complete.",
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exitCode = 1;
});
