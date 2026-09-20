import type { FastifyInstance } from "fastify";

import type { PrismaClient } from "../../../generated/prisma/client";
import { env } from "@/config/env";
import {
  createDemoAccount,
  DEMO_ACCOUNT,
  markDemoReset,
  readLastDemoReset,
  seedDatabase,
} from "./demo-seed";

/**
 * Keeps the public demo usable.
 *
 * Visitors have full access, so the data drifts: customers get renamed, bills
 * get generated, someone empties a deposit. Rather than restricting what they
 * can try, the whole database is dropped and re-seeded on a schedule, and the
 * demo account is recreated with its published password.
 *
 * Everything here is inert unless DEMO_MODE is on.
 */

/** Published on the login screen, so it has to be stable across resets. */
export { DEMO_ACCOUNT };

/**
 * In-process guard against two resets overlapping — a timer firing while a
 * boot-time reset is still running would otherwise wipe half-written data.
 */
let resetInFlight: Promise<void> | null = null;

function getPrisma(app: FastifyInstance) {
  return (app as FastifyInstance & { prisma: PrismaClient }).prisma;
}

function isStale(lastResetAt: Date | null): boolean {
  if (!lastResetAt) return true;

  const ageMs = Date.now() - lastResetAt.getTime();
  return ageMs >= env.demoResetIntervalHours * 60 * 60 * 1000;
}

/**
 * Drops everything and rebuilds it, then recreates the demo account.
 *
 * The seed makes ordinary staff accounts; the guest is added afterwards with a
 * fixed password so the credentials printed on the login screen keep working.
 */
async function runReset(app: FastifyInstance): Promise<void> {
  const prisma = getPrisma(app);
  const startedAt = Date.now();

  app.log.info("demo reset: rebuilding sample data");

  const summary = await seedDatabase({
    prisma,
    password: env.demoGuestPassword,
  });

  await createDemoAccount(prisma, env.demoGuestPassword, env.bcryptSaltRounds);

  await markDemoReset(prisma);

  app.log.info(
    { ...summary, durationMs: Date.now() - startedAt },
    "demo reset: sample data rebuilt",
  );
}

/** Rebuilds the demo, or joins the rebuild already running. */
export async function resetDemoData(app: FastifyInstance): Promise<void> {
  if (!env.demoMode) return;

  resetInFlight ??= runReset(app).finally(() => {
    resetInFlight = null;
  });

  return resetInFlight;
}

/** Rebuilds only if the data is older than the configured interval. */
export async function resetDemoDataIfStale(app: FastifyInstance): Promise<boolean> {
  if (!env.demoMode) return false;

  const lastResetAt = await readLastDemoReset(getPrisma(app));

  if (!isStale(lastResetAt)) return false;

  await resetDemoData(app);
  return true;
}

/**
 * Ensures the demo account exists without touching anything else.
 *
 * Covers the case where the database has data but predates the demo — the
 * first visitor should not have to wait for a full rebuild to sign in.
 */
export async function ensureDemoAccount(app: FastifyInstance): Promise<void> {
  if (!env.demoMode) return;

  const prisma = getPrisma(app);

  const existing = await prisma.user.findUnique({
    where: { mobileNumber: DEMO_ACCOUNT.mobileNumber },
  });

  if (existing) return;

  await createDemoAccount(prisma, env.demoGuestPassword, env.bcryptSaltRounds);

  app.log.info("demo reset: guest account created");
}

/**
 * Starts the reset schedule.
 *
 * Checked on a timer rather than driven by one, because this runs on a host
 * that sleeps when idle: a plain interval would simply stop. Comparing against
 * a stored timestamp means a demo that was asleep for a day still rebuilds on
 * the first request after it wakes.
 */
export function startDemoResetSchedule(app: FastifyInstance): void {
  if (!env.demoMode) return;

  const check = async () => {
    try {
      await resetDemoDataIfStale(app);
    } catch (error) {
      app.log.error({ err: error }, "demo reset failed");
    }
  };

  // At boot, so a cold start serves fresh data.
  void (async () => {
    try {
      await ensureDemoAccount(app);
      await check();
    } catch (error) {
      app.log.error({ err: error }, "demo reset: startup check failed");
    }
  })();

  const timer = setInterval(() => void check(), 15 * 60 * 1000);
  timer.unref();

  app.addHook("onClose", async () => {
    clearInterval(timer);
  });
}
