import { z } from "zod";

export const loginSchema = z.object({
  mobileNumber: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Mobile number must be a 10 digit number"),
  password: z.string().min(1, "Password is required").max(100),
});

export const emptySchema = z.object({});