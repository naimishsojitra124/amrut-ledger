import { apiConnector } from "@/services/utils/apiConnector";

export type MilkTypeStatus = "active" | "inactive";

export interface MilkType {
  _id: string;
  name: string;
  rate: number;
  shortCode: string;
  status: MilkTypeStatus;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MilkTypeListResponse {
  items: MilkType[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    limit: number;
    page: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface MilkTypeListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: MilkTypeStatus;
}

export interface CreateMilkTypeRequest {
  name: string;
  rate: number;
  shortCode: string;
  displayOrder?: number;
}

export interface UpdateMilkTypeRequest {
  name?: string;
  rate?: number;
  shortCode?: string;
  displayOrder?: number;
  status?: MilkTypeStatus;
}

interface MilkTypeApiResponse {
  id: string;
  name: string;
  rate: number;
  shortCode: string;
  status: MilkTypeStatus;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface MilkTypeListApiResponse {
  items: MilkTypeApiResponse[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    limit: number;
    page: number;
    totalItems: number;
    totalPages: number;
  };
}

function normalizeMilkType(item: MilkTypeApiResponse): MilkType {
  return {
    _id: item.id,
    name: item.name,
    rate: item.rate,
    shortCode: item.shortCode,
    status: item.status,
    displayOrder: item.displayOrder,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function getErrorMessage(error: any, fallback: string) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}

export const milkTypeAPI = {
  getMilkTypes: async (
    query?: MilkTypeListQuery,
  ): Promise<MilkTypeListResponse> => {
    try {
      const response = await apiConnector<MilkTypeListApiResponse>(
        "GET",
        "/milk-types",
        undefined,
        undefined,
        // apiConnector expects Record<string, unknown> | undefined
        // assert query to that type
        query as unknown as Record<string, unknown> | undefined,
      );

      return {
        items: response.data.items.map(normalizeMilkType),
        pageInfo: response.data.pageInfo,
      };
    } catch (error: any) {
      throw new Error(getErrorMessage(error, "Failed to fetch milk types"));
    }
  },

  getActiveMilkTypes: async (): Promise<{ items: MilkType[] }> => {
    try {
      const response = await apiConnector<{ items: MilkTypeApiResponse[] }>(
        "GET",
        "/milk-types/active",
      );

      return {
        items: response.data.items.map(normalizeMilkType),
      };
    } catch (error: any) {
      throw new Error(
        getErrorMessage(error, "Failed to fetch active milk types"),
      );
    }
  },

  getMilkTypeById: async (id: string): Promise<MilkType> => {
    try {
      const response = await apiConnector<MilkTypeApiResponse>(
        "GET",
        `/milk-types/${id}`,
      );

      return normalizeMilkType(response.data);
    } catch (error: any) {
      throw new Error(getErrorMessage(error, "Failed to fetch milk type"));
    }
  },

  createMilkType: async (data: CreateMilkTypeRequest): Promise<MilkType> => {
    try {
      const response = await apiConnector<MilkTypeApiResponse>(
        "POST",
        "/milk-types",
        data,
      );

      return normalizeMilkType(response.data);
    } catch (error: any) {
      throw new Error(getErrorMessage(error, "Failed to create milk type"));
    }
  },

  updateMilkType: async (
    id: string,
    data: UpdateMilkTypeRequest,
  ): Promise<MilkType> => {
    try {
      const response = await apiConnector<MilkTypeApiResponse>(
        "PATCH",
        `/milk-types/${id}`,
        data,
      );

      return normalizeMilkType(response.data);
    } catch (error: any) {
      throw new Error(getErrorMessage(error, "Failed to update milk type"));
    }
  },

  archiveMilkType: async (id: string): Promise<MilkType> => {
    try {
      const response = await apiConnector<MilkTypeApiResponse>(
        "PATCH",
        `/milk-types/${id}/archive`,
      );

      return normalizeMilkType(response.data);
    } catch (error: any) {
      throw new Error(getErrorMessage(error, "Failed to archive milk type"));
    }
  },

  restoreMilkType: async (id: string): Promise<MilkType> => {
    try {
      const response = await apiConnector<MilkTypeApiResponse>(
        "PATCH",
        `/milk-types/${id}/restore`,
      );

      return normalizeMilkType(response.data);
    } catch (error: any) {
      throw new Error(getErrorMessage(error, "Failed to restore milk type"));
    }
  },
};
