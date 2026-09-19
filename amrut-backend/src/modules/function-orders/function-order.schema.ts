import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD dates");

const quantitySchema = z.coerce
  .number()
  .positive()
  .refine(
    (value) => Number(value.toFixed(2)) === value,
    "Quantity can have at most 2 decimal places",
  );

const movementSchema = z.object({
  id: z.string().min(1).optional(),

  type: z.enum(["dispatch", "return"]),

  quantity: quantitySchema,

  note: z.string().trim().max(300).default(""),

  createdAt: z.string().datetime().optional(),
});

export const functionOrderItemSchema = z
  .object({
    id: z.string().min(1).optional(),

    itemName: z.string().trim().min(1).max(120),

    quantity: quantitySchema,

    unit: z.string().trim().min(1).max(20).default("kg"),

    // Whole rupees; quantities stay fractional because goods are sold by kg.
    unitPrice: z.coerce.number().int("Unit price must be a whole number of rupees").min(0),

    returnedQuantity: z.coerce.number().min(0).default(0),

    returnNote: z.string().trim().max(300).default(""),

    movements: z.array(movementSchema).default([]),
  })
  .refine((item) => item.returnedQuantity <= item.quantity, {
    message: "Returned quantity cannot exceed quantity",
    path: ["returnedQuantity"],
  });

export const functionOrderDaySchema = z.object({
  deliveryDate: dateSchema,

  deliveryTime: z.string().trim().max(30).default(""),

  peopleCount: z.coerce.number().int().min(0).max(100000).default(0),

  items: z.array(functionOrderItemSchema).min(1),

  notes: z.string().trim().max(500).default(""),
});

const functionOrderStatusSchema = z.enum(["draft", "confirmed", "completed", "cancelled"]);

const orderBody = z.object({
  customerName: z.string().trim().min(1).max(120),

  mobileNumber: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(6).max(20).optional(),
  ),

  eventName: z.string().trim().max(150).default(""),

  deliveryDays: z.array(functionOrderDaySchema).min(1),

  reminderDaysBefore: z.coerce.number().int().min(0).max(14).default(1),

  status: functionOrderStatusSchema.default("draft"),

  notes: z.string().trim().max(1000).default(""),
});

export const createFunctionOrderSchema = orderBody;

export const updateFunctionOrderSchema = orderBody.partial();

export const functionOrderIdParamSchema = z.object({
  id: z.string().min(1),
});

export const functionOrderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(10),

  status: functionOrderStatusSchema.optional(),

  search: z.string().trim().max(120).optional(),
});
