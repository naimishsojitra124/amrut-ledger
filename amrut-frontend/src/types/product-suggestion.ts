export type ProductSuggestionStatus =
  | "active"
  | "inactive";

export interface ProductSuggestion {
  _id: string;
  name: string;
  displayOrder: number;
  status: ProductSuggestionStatus;

  createdAt: Date;
  updatedAt: Date;
}