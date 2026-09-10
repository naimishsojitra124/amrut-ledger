import { apiConnector } from "./utils/apiConnector";

export interface AuthUser {
  id: string;
  fullName: string;
  mobileNumber: string;
  email: string;
  role: "owner" | "manager" | "employee";
  status: "active" | "inactive";
}

export interface LoginRequest {
  mobileNumber: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export const authAPI = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    try {
      const response = await apiConnector<AuthResponse>(
        "POST",
        "/auth/login",
        data,
      );

      return response.data;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message;
      if (errorMessage === "Endpoint not found") {
        throw new Error("Endpoint not found");
      }

      throw new Error(errorMessage || "Login failed. Please try again.");
    }
  },

  me: async (): Promise<{ user: AuthUser }> => {
    try {
      const response = await apiConnector<{ user: AuthUser }>(
        "GET",
        "/auth/me",
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to fetch current user",
      );
    }
  },

  refresh: async (): Promise<AuthResponse> => {
    try {
      const response = await apiConnector<AuthResponse>(
        "POST",
        "/auth/refresh",
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Refresh failed",
      );
    }
  },

  logout: async (): Promise<{ success: true }> => {
    try {
      const response = await apiConnector<{ success: true }>(
        "POST",
        "/auth/logout",
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Logout failed",
      );
    }
  },
};
