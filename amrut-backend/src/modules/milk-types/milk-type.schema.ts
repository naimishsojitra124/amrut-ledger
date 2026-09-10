import { z } from "zod";

export const milkTypeIdParamSchema = z.object({
  id: z.string().min(1, "Milk type id is required"),
});

export const milkTypeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
});

export const createMilkTypeSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  shortCode: z.string().trim().min(1, "Short code is required").max(20),
  rate: z.number().positive("Rate must be greater than 0"),
});

export const updateMilkTypeSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    shortCode: z.string().trim().min(1).max(20),
    rate: z.number().positive(),
  })
  .refine(
    (value) =>
      value.name !== undefined || value.shortCode !== undefined || value.rate !== undefined,
    {
      message: "At least one field is required",
    },
  );
