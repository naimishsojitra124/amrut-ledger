import "dotenv/config";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const client = new MongoClient(url);
await client.connect();
const payments = client.db().collection("payments");
const missing = await payments
  .find({
    $or: [
      { clientRequestId: null },
      { clientRequestId: { $exists: false } },
      { clientRequestId: "" },
    ],
  })
  .project({ _id: 1 })
  .toArray();
if (missing.length)
  await payments.bulkWrite(
    missing.map(({ _id }) => ({
      updateOne: {
        filter: { _id },
        update: { $set: { clientRequestId: `legacy-${randomUUID()}` } },
      },
    })),
  );
console.log(`Backfilled ${missing.length} payment request IDs.`);
await client.close();
