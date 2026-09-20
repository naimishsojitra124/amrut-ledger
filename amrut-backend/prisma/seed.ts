import "dotenv/config";
import { randomBytes } from "node:crypto";

import { PrismaClient } from "../generated/prisma/client";
import {
  createDemoAccount,
  DEMO_ACCOUNT,
  markDemoReset,
  seedDatabase,
} from "../src/modules/demo/demo-seed";

/**
 * Fills a database with the demo dataset.
 *
 * It DROPS every collection first, so it must never be able to run against a
 * production database and must never leave a known password behind:
 *
 *   - production is refused outright,
 *   - any other environment requires an explicit `--force` (or SEED_FORCE=true),
 *   - the seeded password is random and printed once at the end.
 *
 * The public demo uses the same dataset through its scheduled reset, where the
 * password is fixed instead — see `src/modules/demo/demo-reset.service.ts`.
 *
 *   npm run seed -- --force
 *   SEED_PASSWORD=... npm run seed -- --force
 */

const FORCED = process.argv.includes("--force") || process.env.SEED_FORCE === "true";

/**
 * Whether to add the shared guest account on top of the dataset.
 *
 * The seed drops every user, so on a demo database it has to put the guest
 * back — otherwise the login screen advertises credentials that no longer
 * exist, and nobody can sign in until the server's next scheduled check.
 */
const DEMO_MODE = process.env.DEMO_MODE === "true";
const DEMO_GUEST_PASSWORD = process.env.DEMO_GUEST_PASSWORD ?? "GuestDemo2026";

function generateSeedPassword(): string {
  // Satisfies the app password policy: lower + upper + digit, >= 10 chars.
  return `Seed${randomBytes(9).toString("base64url").replace(/[^A-Za-z0-9]/g, "")}7a`;
}

const TEMP_PASSWORD = process.env.SEED_PASSWORD ?? generateSeedPassword();

function redactDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const credentials = parsed.username ? `${parsed.username}:***@` : "";
    return `${parsed.protocol}//${credentials}${parsed.host}${parsed.pathname}`;
  } catch {
    return "<unparseable DATABASE_URL>";
  }
}

function assertSafeToSeed(): void {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const databaseUrl = process.env.DATABASE_URL ?? "";

  if (nodeEnv === "production") {
    throw new Error(
      "Refusing to seed: NODE_ENV=production. This script deletes every record in the database.",
    );
  }

  if (!databaseUrl) {
    throw new Error("Refusing to seed: DATABASE_URL is not set.");
  }

  if (!FORCED) {
    throw new Error(
      [
        "Refusing to seed without an explicit confirmation.",
        "",
        "This script DELETES every user, customer, ledger, bill, payment and audit log in:",
        `  ${redactDatabaseUrl(databaseUrl)}`,
        "",
        "Re-run with --force if that is really what you want:",
        "  npm run seed -- --force",
      ].join("\n"),
    );
  }

  console.warn(
    `About to WIPE and re-seed ${redactDatabaseUrl(databaseUrl)} (NODE_ENV=${nodeEnv}).`,
  );
}

async function main() {
  assertSafeToSeed();

  console.log("Seeding Amrut Ledger database...");

  const prisma = new PrismaClient();

  try {
    await seedDatabase({ prisma, password: TEMP_PASSWORD, log: console.log });

    if (DEMO_MODE) {
      await createDemoAccount(prisma, DEMO_GUEST_PASSWORD);

      // Otherwise a running server still sees an old timestamp and wipes what
      // was just seeded at its next scheduled check.
      await markDemoReset(prisma);

      console.log("Guest account: created");
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log("");
  console.log("─".repeat(60));
  console.log("Seeded user password (shown once, not stored anywhere):");
  console.log(`  ${TEMP_PASSWORD}`);
  console.log("Change it from Settings > Users before using this data.");

  if (DEMO_MODE) {
    console.log("");
    console.log("DEMO_MODE is on, so the shared guest account was added too:");
    console.log(`  ${DEMO_ACCOUNT.mobileNumber} / ${DEMO_GUEST_PASSWORD}`);
  }

  console.log("─".repeat(60));
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exitCode = 1;
});
