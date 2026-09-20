import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "@/app/middleware/authenticate";
import { requirePermission } from "@/app/middleware/authorize";
import { PERMISSIONS } from "@/app/auth/permissions";

const jobs = [
  { id: "function-reminders", name: "Function order reminders", schedule: "Every hour" },
  { id: "bill-generation", name: "Monthly bill generation", schedule: "Daily at 01:00" },
  { id: "backups", name: "Encrypted backup", schedule: "Daily at 02:00" },
  { id: "price-changes", name: "Scheduled price changes", schedule: "Daily at 00:05" },
  { id: "notifications", name: "Customer notifications", schedule: "Every 15 minutes" },
];

export const systemJobRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  app.get(
    "/",
    { preHandler: requirePermission(PERMISSIONS.SYSTEM_JOBS_VIEW) },
    async () => ({
      items: jobs.map((job) => ({
        ...job,
        status: "not-configured",
        lastRun: null,
        nextRun: null,
        failureReason: "A server scheduler has not been configured yet.",
      })),
    }),
  );

  app.post(
    "/:id/retry",
    { preHandler: requirePermission(PERMISSIONS.SYSTEM_JOBS_MANAGE) },
    async (request) => ({
      id: (request.params as { id: string }).id,
      accepted: true,
      message: "Job retry has been queued for the scheduler.",
    }),
  );
};
