import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "@/app/middleware/authenticate";
import { requirePermission } from "@/app/middleware/authorize";
import { PERMISSIONS } from "@/app/auth/permissions";
import { getJobRun } from "@/app/jobs/job-registry";
import {
  FUNCTION_REMINDER_JOB_ID,
  functionReminderSchedule,
  runFunctionReminderJob,
} from "@/modules/function-orders/function-order.job";
import { createHttpError } from "@/app/http-error";

const NOT_CONFIGURED = "A server scheduler has not been configured yet.";

const jobs = [
  { id: FUNCTION_REMINDER_JOB_ID, name: "Function order reminders" },
  { id: "bill-generation", name: "Monthly bill generation", schedule: "Daily at 01:00" },
  { id: "backups", name: "Encrypted backup", schedule: "Daily at 02:00" },
  { id: "price-changes", name: "Scheduled price changes", schedule: "Daily at 00:05" },
  { id: "notifications", name: "Customer notifications", schedule: "Every 15 minutes" },
];

// Only the reminder job actually runs; the rest stay honest about not being wired up.
const runnable: Record<string, (app: Parameters<FastifyPluginAsync>[0]) => Promise<void>> = {
  [FUNCTION_REMINDER_JOB_ID]: runFunctionReminderJob,
};

export const systemJobRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  app.get(
    "/",
    { preHandler: requirePermission(PERMISSIONS.SYSTEM_JOBS_VIEW) },
    async () => ({
      items: jobs.map((job) => {
        const run = getJobRun(job.id);

        if (!run) {
          return {
            ...job,
            schedule: job.schedule ?? functionReminderSchedule(),
            status: "not-configured",
            lastRun: null,
            nextRun: null,
            detail: "",
            durationMs: null,
            failureReason: NOT_CONFIGURED,
          };
        }

        return {
          id: job.id,
          name: job.name,
          schedule: job.schedule ?? functionReminderSchedule(),
          status: run.status,
          lastRun: run.lastRun,
          nextRun: run.nextRun,
          durationMs: run.durationMs,
          detail: run.detail,
          failureReason: run.failureReason,
        };
      }),
    }),
  );

  app.post(
    "/:id/retry",
    { preHandler: requirePermission(PERMISSIONS.SYSTEM_JOBS_MANAGE) },
    async (request) => {
      const { id } = request.params as { id: string };
      const run = runnable[id];

      if (!run) {
        throw createHttpError(400, "That job has no scheduler to run yet.");
      }

      await run(app);

      const result = getJobRun(id);

      return {
        id,
        accepted: true,
        status: result?.status ?? "ok",
        message: result?.detail || "Job finished.",
      };
    },
  );
};
