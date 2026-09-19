import { z } from "zod";

export const businessDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

export const customerIdParamSchema = z.object({
  customerId: z.string().min(1, "Customer id is required"),
});

export const dailyLedgerDateParamSchema = z.object({
  customerId: z.string().min(1, "Customer id is required"),
  date: businessDateSchema,
});

export const dailyLedgerEntryIndexParamSchema = z.object({
  customerId: z.string().min(1, "Customer id is required"),
  date: businessDateSchema,
  entryIndex: z.coerce.number().int().min(0),
});

export const dailyLedgerListQuerySchema = z
  .object({
    // Query-string values always arrive as strings; without coercion every
    // paginated request to this endpoint failed validation.
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
  })
  .refine(
    (value) =>
      (value.month === undefined && value.year === undefined) ||
      (value.month !== undefined && value.year !== undefined),
    {
      message: "Month and year must be provided together",
    },
  );

export const dailyLedgerMilkEntrySchema = z.object({
  milkTypeId: z.string().min(1, "Milk type id is required"),
  litres: z.coerce.number().positive("Litres must be greater than 0"),
});

export const dailyLedgerProductEntrySchema = z.object({
  productSuggestionId: z.string().min(1).optional().nullable(),
  itemName: z.string().trim().min(1, "Item name is required").max(100),
  quantity: z.coerce.number().int().positive("Quantity must be greater than 0"),
  // Whole rupees, matching how money is stored throughout the system.
  unitPrice: z.coerce
    .number()
    .int("Unit price must be a whole number of rupees")
    .positive("Unit price must be greater than 0"),
});

export const createDailyLedgerSchema = z.object({
  notes: z.string().trim().max(500).optional(),
});

export const addDailyLedgerEntrySchema = z
  .object({
    clientRequestId: z.string().uuid().optional(),
    milkEntries: z.array(dailyLedgerMilkEntrySchema).optional(),
    productEntries: z.array(dailyLedgerProductEntrySchema).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine(
    (value) =>
      (value.productEntries?.length ?? 0) > 0 ||
      (value.milkEntries?.length ?? 0) > 0,
    {
      message: "At least one entry is required",
    },
  );

export const updateDailyLedgerEntrySchema = z.object({
  milkEntries: z.array(dailyLedgerMilkEntrySchema).optional(),
  productEntries: z.array(dailyLedgerProductEntrySchema).optional(),
  notes: z.string().trim().max(500).optional(),
});
