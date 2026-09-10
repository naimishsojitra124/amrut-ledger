import { z } from "zod";

export const cardIdParamSchema = z.object({
  id: z.string().min(1, "Card id is required"),
});

export const customerIdParamSchema = z.object({
  customerId: z.string().min(1, "Customer id is required"),
});

export const cardAssignmentParamSchema = z.object({
  cardId: z.string().min(1, "Card id is required"),
});

export const cardListQuerySchema = z.object({
  status: z.enum(["assigned", "available"]).optional(),
  search: z.string().trim().min(1).optional(),
}).loose();

export const createCardSchema = z.object({
  cardNumber: z.coerce.number().int().positive("Card number must be a positive integer"),
});

export const updateCardSchema = z
  .object({
    cardNumber: z.coerce.number().int().positive(),
  })
  .refine((value) => value.cardNumber !== undefined, {
    message: "At least one field is required",
  });

export const assignCardSchema = z.object({
  customerId: z.string().min(1, "Customer id is required"),
  depositAtAssignment: z.coerce.number().min(0),
  assignedAt: z.coerce.date(),
});