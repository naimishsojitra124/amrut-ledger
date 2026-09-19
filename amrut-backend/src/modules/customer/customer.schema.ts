import { z } from "zod";

export const customerIdParamSchema = z.object({
  id: z.string().min(1, "Customer id is required"),
});

export const customerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["active", "archived"]).optional(),
  search: z.string().trim().min(1).optional(),
});

export const customerCardLookupQuerySchema = z.object({
  cardNumber: z.coerce.number().int().positive(),
});

const customerMilkTypeSchema = z.object({
  primaryMilkTypeId: z.string().min(1, "Primary milk type is required"),
  otherMilkTypeIds: z.array(z.string().min(1)).optional(),
});

const customerCardSchema = z.object({
  cardNumber: z.coerce.number().int().positive(),
});

export const createCustomerSchema = z
  .object({
    fullName: z.string().trim().min(1, "Name is required").max(120),
    mobileNumber: z.string().trim().optional(),
    address: z.string().trim().max(250).optional(),
    depositAmount: z.coerce.number().int().min(0),
    notes: z.string().trim().max(1000).optional(),
  })
  .merge(customerMilkTypeSchema)
  .merge(customerCardSchema)
  .refine(
    (value) => {
      const all = [value.primaryMilkTypeId, ...(value.otherMilkTypeIds ?? [])];
      return new Set(all).size === all.length;
    },
    { message: "Milk types cannot contain duplicates" },
  )
  .refine((value) => !(value.otherMilkTypeIds ?? []).includes(value.primaryMilkTypeId), {
    message: "Primary milk type cannot also appear in other milk types",
  });

export const updateCustomerSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120),
    mobileNumber: z
      .string()
      .trim()
      .regex(/^\d{10}$/, "Mobile number must be a 10 digit number"),
    address: z.string().trim().min(1).max(250),
    depositAmount: z.coerce.number().int().min(0).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .merge(customerMilkTypeSchema.partial())
  .merge(customerCardSchema)
  .refine(
    (value) => {
      const all = [
        ...(value.primaryMilkTypeId ? [value.primaryMilkTypeId] : []),
        ...((value.otherMilkTypeIds ?? []) as string[]),
      ];
      return all.length === 0 || new Set(all).size === all.length;
    },
    { message: "Milk types cannot contain duplicates" },
  )
  .refine(
    (value) => {
      if (!value.primaryMilkTypeId) return true;
      return !(value.otherMilkTypeIds ?? []).includes(value.primaryMilkTypeId);
    },
    { message: "Primary milk type cannot also appear in other milk types" },
  );

const auditLogTypeSchema = z.enum([
  "customer_created",
  "customer_updated",
  "customer_closed",
  "customer_reopened",
  "card_assigned",
  "card_unassigned",
  "milk_type_changed",
  "deposit_updated",
  "entry_added",
  "entry_updated",
  "entry_deleted",
  "bill_generated",
  "payment_added",
  "note_added",
]);

export const customerPageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  types: z.preprocess(
    (value) =>
      typeof value === "string"
        ? value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : value,
    z.array(auditLogTypeSchema).optional(),
  ),
});

export const customerMonthQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const archiveCustomerSchema = z.object({
  refundDeposit: z.boolean().default(false),
});

export const depositTransactionSchema = z.object({
  amount: z.coerce.number().positive().max(1_000_000),
  notes: z.string().trim().max(500).optional(),
});
