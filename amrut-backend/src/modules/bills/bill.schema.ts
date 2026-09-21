import { z } from "zod";

export const billIdParamSchema = z.object({
  billId: z.string().min(1, "Bill id is required"),
});

export const customerIdParamSchema = z.object({
  customerId: z.string().min(1, "Customer id is required"),
});

export const customerBillMonthParamSchema = z.object({
  customerId: z.string().min(1, "Customer id is required"),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const paymentIdParamSchema = z.object({
  paymentId: z.string().min(1, "Payment id is required"),
});

export const billListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  customerId: z.string().trim().min(1).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  status: z.enum(["paid", "partial", "unpaid"]).optional(),
  search: z.string().trim().min(1).max(80).optional(),
});

export const paymentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  customerId: z.string().trim().min(1).optional(),
  billId: z.string().trim().min(1).optional(),
  billMonth: z.coerce.number().int().min(1).max(12).optional(),
  billYear: z.coerce.number().int().min(2000).max(2100).optional(),
  paymentMethod: z.enum(["cash", "upi"]).optional(),
  search: z.string().trim().min(1).max(80).optional(),
});

export const generateBillSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

export const createPaymentSchema = z
  .object({
    clientRequestId: z.string().uuid("A client request id is required"),
    billId: z.string().min(1, "Bill id is required"),
    amount: z.coerce.number().min(0, "Payment amount cannot be negative"),
    useDeposit: z.boolean().optional().default(false),
    paymentMethod: z.enum(["cash", "upi"]),
    referenceNumber: z.string().trim().max(100).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((value) => value.amount > 0 || value.useDeposit, {
    message: "Enter a payment amount or use the deposit",
    path: ["amount"],
  });

export const reversePaymentSchema = z.object({
  reason: z.string().trim().min(5, "A reversal reason is required").max(500),
});
