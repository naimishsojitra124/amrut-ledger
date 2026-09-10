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
};
