import "dotenv/config";
import { randomBytes } from "node:crypto";

import { PrismaClient } from "../generated/prisma/client";
import {
  createDemoAccount,
  DEMO_ACCOUNT,
  markDemoReset,
  seedDatabase,
} from "../src/modules/demo/demo-seed";

const FORCED = process.argv.includes("--force") || process.env.SEED_FORCE === "true";

const DEMO_MODE = process.env.DEMO_MODE === "true";
const DEMO_GUEST_PASSWORD = process.env.DEMO_GUEST_PASSWORD ?? "GuestDemo2026";

function generateSeedPassword(): string {
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

function getDatabaseName(url: string): string | null {
  try {
    const name = new URL(url).pathname.replace(/^\//, "").trim();
    return name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

// --db <name>, --db=<name>, or SEED_DATABASE_NAME.
function getIntendedDatabaseName(): string | null {
  const flagIndex = process.argv.indexOf("--db");

  if (flagIndex !== -1) {
    return process.argv[flagIndex + 1]?.trim() ?? null;
  }

  const inline = process.argv
    .find((argument) => argument.startsWith("--db="))
    ?.slice("--db=".length)
    .trim();

  return inline || process.env.SEED_DATABASE_NAME?.trim() || null;
}

// NODE_ENV describes the process, not the connection string, so the database is named explicitly.
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

  const actual = getDatabaseName(databaseUrl);

  if (!actual) {
    throw new Error(
      "Refusing to seed: DATABASE_URL does not name a database, so the target cannot be confirmed.",
    );
  }

  const intended = getIntendedDatabaseName();

  if (!FORCED || !intended) {
    throw new Error(
      [
        "Refusing to seed without an explicit confirmation.",
        "",
        "This DELETES every user, customer, ledger, bill, payment and audit log in:",
        `  ${redactDatabaseUrl(databaseUrl)}`,
        "",
        "Name the database to confirm it is the one you mean:",
        `  npm run seed -- --force --db ${actual}`,
      ].join("\n"),
    );
  }

  if (intended !== actual) {
    throw new Error(
      [
        `Refusing to seed: you asked to wipe "${intended}", but DATABASE_URL points at "${actual}".`,
        "",
        `  ${redactDatabaseUrl(databaseUrl)}`,
        "",
        "Check which .env is loaded before re-running.",
      ].join("\n"),
    );
  }

  console.warn(
    `About to WIPE and re-seed "${actual}" — ${redactDatabaseUrl(databaseUrl)} (NODE_ENV=${nodeEnv}).`,
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
