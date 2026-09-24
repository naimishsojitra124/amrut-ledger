import { z } from "zod";

export const productSuggestionIdParamSchema = z.object({
  id: z.string().min(1, "Product suggestion id is required"),
});

export const productSuggestionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(80).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const createProductSuggestionSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  displayOrder: z.number().int().min(0).optional(),
});

export const updateProductSuggestionSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    displayOrder: z.coerce.number().int().min(0).optional(),
  })
  .refine((value) => value.name !== undefined || value.displayOrder !== undefined, {
    message: "At least one field is required",
  });

export const reorderProductSuggestionsSchema = z
  .object({
    orderedIds: z.array(z.string().min(1)).min(1, "orderedIds cannot be empty"),
  })
  .refine((value) => new Set(value.orderedIds).size === value.orderedIds.length, {
    message: "orderedIds cannot contain duplicates",
  });
