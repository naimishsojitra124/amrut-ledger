import type { ProductSuggestionStatus } from "../../../generated/prisma/enums";

export interface ProductSuggestionResponse {
  id: string;
  name: string;
  displayOrder: number;
  status: ProductSuggestionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductSuggestionListResponse {
  items: ProductSuggestionResponse[];
  pageInfo: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface ProductSuggestionActiveResponse {
  items: ProductSuggestionResponse[];
}

export interface ProductSuggestionReorderResponse {
  items: ProductSuggestionResponse[];
}

export interface CreateProductSuggestionRequest {
  name: string;
  displayOrder?: number | undefined;
}

export interface UpdateProductSuggestionRequest {
  name?: string | undefined;
  displayOrder?: number | undefined;
}



export interface ProductSuggestionListQuery {
  page?: number;
  limit?: number;
  search?: string | undefined;
  status?: "active" | "inactive" | undefined;
}

