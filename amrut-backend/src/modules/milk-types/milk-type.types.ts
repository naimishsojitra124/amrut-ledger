import type { MilkTypeStatus } from "../../../generated/prisma/enums";

export interface MilkTypeResponse {
  id: string;
  name: string;
  shortCode: string;
  rate: number;
  status: MilkTypeStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface MilkTypeListItemResponse extends MilkTypeResponse {}

export interface PageInfo {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface MilkTypeListResponse {
  items: MilkTypeListItemResponse[];
  pageInfo: PageInfo;
}

export interface CreateMilkTypeRequest {
  name: string;
  shortCode: string;
  rate: number;
}

export interface UpdateMilkTypeRequest {
  name?: string | undefined;
  shortCode?: string | undefined;
  rate?: number | undefined;
}

export interface MilkTypeListQuery {
  page?: number;
  limit?: number;
  search?: string | undefined;
  status?: "active" | "inactive" | undefined;
}


