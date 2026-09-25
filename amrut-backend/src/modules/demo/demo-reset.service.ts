import type { FastifyInstance } from "fastify";

import { env } from "@/config/env";
import {
  createDemoAccount,
  DEMO_ACCOUNT,
  markDemoReset,
  readLastDemoReset,
  seedDatabase,
} from "./demo-seed";
import { getPrisma } from "@/app/db/prisma";

export { DEMO_ACCOUNT };

let resetInFlight: Promise<void> | null = null;

// A reseed drops and rebuilds every collection: tens of seconds of solid database work
// on a small instance. Running it while someone is on the demo is what turns a page load
// into a long wait, so it waits for a lull instead.
const QUIET_PERIOD_MS = 10 * 60 * 1000;

let lastVisitorRequestAt = 0;

/** Uptime monitors ping around the clock; counting those would defer the reseed for ever. */
export function recordVisitorRequest(url: string): void {
  if (url.startsWith("/health")) return;

  lastVisitorRequestAt = Date.now();
}

export function demoIsInUse(): boolean {
  return lastVisitorRequestAt > 0 && Date.now() - lastVisitorRequestAt < QUIET_PERIOD_MS;
}

/** Test seam: the tracker is module state, so a test needs a way back to a clean slate. */
export function forgetVisitorActivity(): void {
  lastVisitorRequestAt = 0;
}

function watchVisitorActivity(app: FastifyInstance): void {
  app.addHook("onRequest", async (request) => recordVisitorRequest(request.url));
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
async function resetDemoData(app: FastifyInstance): Promise<void> {
  if (!env.demoMode) return;

  resetInFlight ??= runReset(app).finally(() => {
    resetInFlight = null;
  });

  return resetInFlight;
}

async function resetDemoDataIfStale(app: FastifyInstance): Promise<boolean> {
  if (!env.demoMode) return false;

  const lastResetAt = await readLastDemoReset(getPrisma(app));

  if (!isStale(lastResetAt)) return false;

  // Stale, but someone is looking at it. The next tick tries again.
  if (demoIsInUse()) {
    app.log.info(
      { lastVisitorRequestAt: new Date(lastVisitorRequestAt).toISOString() },
      "demo reset: deferred, the demo is in use",
    );
    return false;
  }

  await resetDemoData(app);
  return true;
}

// Covers a database that has data but predates the demo, so the first visitor can sign in.
async function ensureDemoAccount(app: FastifyInstance): Promise<void> {
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

  watchVisitorActivity(app);

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
