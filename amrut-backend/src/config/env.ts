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

    /**
     * Diagnostics are opt-in and deliberately NOT derived from NODE_ENV.
     *
     * A deployed service that is missing NODE_ENV=production used to silently
     * turn on full Prisma query logging and the pino-pretty transport, both of
     * which are expensive and were adding real latency to every request.
     */
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional(),
    LOG_PRETTY: z.enum(["true", "false"]).optional(),
    PRISMA_LOG_QUERIES: z.enum(["true", "false"]).default("false"),

    /**
     * Interactive transactions run several round trips. On a deployment whose
     * database is in another region each of those costs real time, so the
     * ceiling is configurable rather than stuck at Prisma's 5s default.
     */
    DB_TRANSACTION_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(20_000),
    DB_TRANSACTION_MAX_WAIT_MS: z.coerce.number().int().min(2_000).max(60_000).default(10_000),

    /**
     * Opens a passwordless, read-only "explore as guest" door for a public
     * demo. Off unless explicitly enabled, so the real deployment never has it.
     *
     * ⚠️ A demo deployment MUST point at its own database. Guests can read
     * every customer's name, phone number, address and outstanding balance —
     * pointing this at the live database publishes all of it.
     */
    DEMO_MODE: z.enum(["true", "false"]).default("false"),

    /**
     * The password printed on the demo login screen. Public by design, so it
     * must never be a password used anywhere real.
     */
    DEMO_GUEST_PASSWORD: z.string().min(10).default("GuestDemo2026"),

    /**
     * How long the demo runs before it is wiped and re-seeded.
     *
     * Visitors have full access, so the data drifts. Rebuilding on a schedule
     * is what lets them try anything without spoiling it for the next person.
     */
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
  cookieSecure: parsed.COOKIE_SECURE === "true",
  cookieSameSite: parsed.COOKIE_SAME_SITE,
  corsOrigins: parsed.CORS_ORIGIN?.split(",").map((origin) => origin.trim()) ?? [
    "http://localhost:3000",
  ],
  nodeEnv: parsed.NODE_ENV,
  port: parsed.PORT,
  host: parsed.HOST,

  logLevel: parsed.LOG_LEVEL ?? (parsed.NODE_ENV === "production" ? "info" : "debug"),
  // Pretty printing spawns a transport worker and formats every line. Useful at
  // a terminal, wasteful on a server.
  logPretty: parsed.LOG_PRETTY === "true" || (parsed.LOG_PRETTY === undefined && parsed.NODE_ENV === "development"),
  prismaLogQueries: parsed.PRISMA_LOG_QUERIES === "true",

  dbTransactionTimeoutMs: parsed.DB_TRANSACTION_TIMEOUT_MS,
  dbTransactionMaxWaitMs: parsed.DB_TRANSACTION_MAX_WAIT_MS,

  demoMode: parsed.DEMO_MODE === "true",
  demoGuestPassword: parsed.DEMO_GUEST_PASSWORD,
  demoResetIntervalHours: parsed.DEMO_RESET_INTERVAL_HOURS,
};
