import type { FastifyInstance } from "fastify";

import { env } from "@/config/env";
import { setJobRun } from "@/app/jobs/job-registry";
import { getFunctionOrderPreparation } from "./function-order.service";

export const FUNCTION_REMINDER_JOB_ID = "function-reminders";

let runInFlight: Promise<void> | null = null;

function intervalMs(): number {
  return env.functionReminderIntervalMinutes * 60_000;
}

function describeSchedule(): string {
  const minutes = env.functionReminderIntervalMinutes;

  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "Every hour" : `Every ${hours} hours`;
  }

  return `Every ${minutes} minutes`;
}

async function execute(app: FastifyInstance): Promise<void> {
  const startedAt = Date.now();

  setJobRun(FUNCTION_REMINDER_JOB_ID, { status: "running", failureReason: null });

  try {
    const result = await getFunctionOrderPreparation(app, env.functionReminderDaysAhead);

    const due = result.days.filter((day) => day.dueForReminder);
    const itemCount = result.preparation.reduce((total, day) => total + day.items.length, 0);

    const detail =
      result.days.length === 0
        ? `Nothing to prepare in the next ${result.daysAhead} day(s).`
        : `${result.days.length} delivery day(s) in the next ${result.daysAhead}, ${due.length} due now, ${itemCount} item line(s) to prepare.`;

    app.log.info(
      {
        daysAhead: result.daysAhead,
        deliveryDays: result.days.length,
        dueNow: due.length,
        orders: [...new Set(result.days.map((day) => day.orderNumber))],
        durationMs: Date.now() - startedAt,
      },
      "function reminders: preparation list rebuilt",
    );

    // Open tablets drop their cached reminder list and pick the new one up, the same way
    // they react to someone editing an order.
    app.realtime.publish({
      resource: "function-order",
      action: "updated",
      phase: "success",
      requestId: `job:${FUNCTION_REMINDER_JOB_ID}`,
      method: "JOB",
      url: `/system/jobs/${FUNCTION_REMINDER_JOB_ID}`,
      route: `/system/jobs/${FUNCTION_REMINDER_JOB_ID}`,
      status: 200,
      actor: null,
      originClientId: null,
    });

    setJobRun(FUNCTION_REMINDER_JOB_ID, {
      status: "ok",
      lastRun: new Date().toISOString(),
      nextRun: new Date(Date.now() + intervalMs()).toISOString(),
      durationMs: Date.now() - startedAt,
      detail,
      failureReason: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The reminder job failed.";

    app.log.error({ err: error }, "function reminders: run failed");

    setJobRun(FUNCTION_REMINDER_JOB_ID, {
      status: "failed",
      lastRun: new Date().toISOString(),
      nextRun: new Date(Date.now() + intervalMs()).toISOString(),
      durationMs: Date.now() - startedAt,
      failureReason: message,
    });

    throw error;
  }
}

/** Joins the run already in progress rather than starting a second one over it. */
export async function runFunctionReminderJob(app: FastifyInstance): Promise<void> {
  runInFlight ??= execute(app).finally(() => {
    runInFlight = null;
  });

  return runInFlight;
}

export function startFunctionReminderSchedule(app: FastifyInstance): void {
  if (!env.functionReminderEnabled) {
    setJobRun(FUNCTION_REMINDER_JOB_ID, {
      status: "not-configured",
      failureReason: "FUNCTION_REMINDER_ENABLED is off.",
    });
    return;
  }

  setJobRun(FUNCTION_REMINDER_JOB_ID, {
    status: "scheduled",
    nextRun: new Date(Date.now() + intervalMs()).toISOString(),
    detail: `${describeSchedule()}, looking ${env.functionReminderDaysAhead} day(s) ahead.`,
  });

  const tick = async () => {
    try {
      await runFunctionReminderJob(app);
    } catch {
      // Already logged and recorded; the next tick retries.
    }
  };

  // One pass at startup, so a restart does not leave the list stale until the next tick.
  void tick();

  const timer = setInterval(() => void tick(), intervalMs());
  timer.unref();

  app.addHook("onClose", async () => {
    clearInterval(timer);
  });
}

export function functionReminderSchedule(): string {
  return describeSchedule();
}
