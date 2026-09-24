import "dotenv/config";
import { z } from "zod";

import type { SignOptions } from "jsonwebtoken";

type JwtExpiresIn = NonNullable<SignOptions["expiresIn"]>;

const config = z
  .object({
    DATABASE_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
    BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
    COOKIE_SECURE: z.enum(["true", "false"]).optional(),
    COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
    CORS_ORIGIN: z.string().optional(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(5000),
    HOST: z.string().default("0.0.0.0"),

    // Swagger at /docs is unauthenticated, so it stays off in production unless asked for.
    ENABLE_API_DOCS: z.enum(["true", "false"]).optional(),

    PUBLIC_API_URL: z.string().optional(),

    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional(),
    LOG_PRETTY: z.enum(["true", "false"]).optional(),
    // Opt-in, not derived from NODE_ENV: a deployment missing it used to log every query it ran.
    PRISMA_LOG_QUERIES: z.enum(["true", "false"]).default("false"),

    // Tunable because the right ceiling depends on how far the database is from the app.
    DB_TRANSACTION_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(20_000),
    DB_TRANSACTION_MAX_WAIT_MS: z.coerce.number().int().min(2_000).max(60_000).default(10_000),

    // Ahead-of-time warning for catering orders, so the kitchen can prepare the items.
    FUNCTION_REMINDER_ENABLED: z.enum(["true", "false"]).default("true"),
    FUNCTION_REMINDER_DAYS_AHEAD: z.coerce.number().int().min(1).max(14).default(2),
    FUNCTION_REMINDER_INTERVAL_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),

    // Must point at its own database: the reset job deletes every collection it can reach.
    DEMO_MODE: z.enum(["true", "false"]).default("false"),

    // Printed on the login screen, so never reuse a real password here.
    DEMO_GUEST_PASSWORD: z.string().min(10).default("GuestDemo2026"),

    // Visitors can change anything, so the data is rebuilt rather than protected.
    DEMO_RESET_INTERVAL_HOURS: z.coerce.number().min(1).max(720).default(6),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === "production" && !value.CORS_ORIGIN)
      context.addIssue({ code: "custom", message: "CORS_ORIGIN is required in production" });
    if (value.NODE_ENV === "production" && value.COOKIE_SECURE !== "true")
      context.addIssue({ code: "custom", message: "COOKIE_SECURE=true is required in production" });
    if (value.COOKIE_SAME_SITE === "none" && value.COOKIE_SECURE !== "true")
      context.addIssue({ code: "custom", message: "SameSite=None requires COOKIE_SECURE=true" });
  });
const parsed = config.parse(process.env);

export const env = {
  databaseUrl: parsed.DATABASE_URL,
  jwtAccessSecret: parsed.JWT_ACCESS_SECRET,
  jwtRefreshSecret: parsed.JWT_REFRESH_SECRET,
  jwtAccessExpiresIn: parsed.JWT_ACCESS_EXPIRES_IN as JwtExpiresIn,
  jwtRefreshExpiresIn: parsed.JWT_REFRESH_EXPIRES_IN as JwtExpiresIn,
  bcryptSaltRounds: parsed.BCRYPT_SALT_ROUNDS,
  enableApiDocs: parsed.ENABLE_API_DOCS
    ? parsed.ENABLE_API_DOCS === "true"
    : parsed.NODE_ENV !== "production",
  publicApiUrl: parsed.PUBLIC_API_URL,
  cookieSecure: parsed.COOKIE_SECURE === "true",
  cookieSameSite: parsed.COOKIE_SAME_SITE,
  corsOrigins: parsed.CORS_ORIGIN?.split(",").map((origin) => origin.trim()) ?? [
    "http://localhost:3000",
  ],
  nodeEnv: parsed.NODE_ENV,
  port: parsed.PORT,
  host: parsed.HOST,

  logLevel: parsed.LOG_LEVEL ?? (parsed.NODE_ENV === "production" ? "info" : "debug"),
  logPretty: parsed.LOG_PRETTY === "true" || (parsed.LOG_PRETTY === undefined && parsed.NODE_ENV === "development"),
  prismaLogQueries: parsed.PRISMA_LOG_QUERIES === "true",

  dbTransactionTimeoutMs: parsed.DB_TRANSACTION_TIMEOUT_MS,
  dbTransactionMaxWaitMs: parsed.DB_TRANSACTION_MAX_WAIT_MS,

  functionReminderEnabled: parsed.FUNCTION_REMINDER_ENABLED === "true",
  functionReminderDaysAhead: parsed.FUNCTION_REMINDER_DAYS_AHEAD,
  functionReminderIntervalMinutes: parsed.FUNCTION_REMINDER_INTERVAL_MINUTES,

  demoMode: parsed.DEMO_MODE === "true",
  demoGuestPassword: parsed.DEMO_GUEST_PASSWORD,
  demoResetIntervalHours: parsed.DEMO_RESET_INTERVAL_HOURS,
};
