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

export { DEMO_ACCOUNT };

let resetInFlight: Promise<void> | null = null;

function getPrisma(app: FastifyInstance) {
  return (app as FastifyInstance & { prisma: PrismaClient }).prisma;
}

// Compared against a stored timestamp, because this host sleeps and a timer would just stop.
function isStale(lastResetAt: Date | null): boolean {
  if (!lastResetAt) return true;

  const ageMs = Date.now() - lastResetAt.getTime();
  return ageMs >= env.demoResetIntervalHours * 60 * 60 * 1000;
}

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

// Joins the rebuild already running rather than starting a second one over it.
export async function resetDemoData(app: FastifyInstance): Promise<void> {
  if (!env.demoMode) return;

  resetInFlight ??= runReset(app).finally(() => {
    resetInFlight = null;
  });

  return resetInFlight;
}

export async function resetDemoDataIfStale(app: FastifyInstance): Promise<boolean> {
  if (!env.demoMode) return false;

  const lastResetAt = await readLastDemoReset(getPrisma(app));

  if (!isStale(lastResetAt)) return false;

  await resetDemoData(app);
  return true;
}

// Covers a database that has data but predates the demo, so the first visitor can sign in.
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

export function startDemoResetSchedule(app: FastifyInstance): void {
  if (!env.demoMode) return;

  const check = async () => {
    try {
      await resetDemoDataIfStale(app);
    } catch (error) {
      app.log.error({ err: error }, "demo reset failed");
    }
  };

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
