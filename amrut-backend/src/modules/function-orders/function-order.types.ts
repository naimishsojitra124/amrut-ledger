import type { z } from "zod";
import type { createFunctionOrderSchema, updateFunctionOrderSchema } from "./function-order.schema";

export type CreateFunctionOrderRequest = z.infer<typeof createFunctionOrderSchema>;
export type UpdateFunctionOrderRequest = z.infer<typeof updateFunctionOrderSchema>;
