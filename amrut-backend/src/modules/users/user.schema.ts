import { z } from "zod";

const passwordSchema = z.string().min(10, "Password must be at least 10 characters").max(128)
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/\d/, "Password must include a number");

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().min(1).max(80).optional(),
});

export const userIdParamSchema = z.object({
  id: z.string().min(1, "User id is required"),
});

export const createUserSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(120),
  mobileNumber: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Mobile number must be a 10 digit number"),
  email: z.string().trim().email("Invalid email"),
  password: passwordSchema,
  role: z.enum(["owner", "manager", "employee"]),
});

export const updateUserSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120),
    mobileNumber: z
      .string()
      .trim()
      .regex(/^\d{10}$/, "Mobile number must be a 10 digit number"),
    email: z.string().trim().email("Invalid email"),
  })
  .refine(
    (value) =>
      value.fullName !== undefined ||
      value.mobileNumber !== undefined ||
      value.email !== undefined,
    {
      message: "At least one field is required",
    },
  );

export const changeUserPasswordSchema = z.object({
  password: passwordSchema,
});

/** Self-service change: proving you know the current password is the point. */
export const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: passwordSchema,
});

export const changeUserRoleSchema = z.object({
  // `guest` is deliberately absent: it belongs to the public demo account
  // and must never be assignable to a real person through the UI.
  role: z.enum(["owner", "manager", "employee"]),
});
