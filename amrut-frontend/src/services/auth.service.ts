import { apiConnector } from "./utils/apiConnector";

// Shorter than the default, so a sleeping backend is retried rather than waited out.
const REFRESH_TIMEOUT_MS = 20_000;
import type { Permission } from "@/config/permissions";

export interface AuthUser {
  id: string;
  fullName: string;
  mobileNumber: string;
  email: string;
  role: "owner" | "manager" | "employee" | "guest";
  status: "active" | "inactive";
  permissions: Permission[];
}

export interface LoginRequest {
  mobileNumber: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

// Whether this deployment is a public demo, and the credentials to use. */
export interface AuthConfig {
  demoMode: boolean;
  demoCredentials: { mobileNumber: string; password: string } | null;
  demoResetIntervalHours: number | null;
}

export const authAPI = {
  config: async (): Promise<AuthConfig> => {
    const response = await apiConnector<AuthConfig>("GET", "/auth/config");
    return response.data;
  },

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

  // The error is deliberately not rewrapped: the caller has to tell "the server refused"
  // apart from "the server could not be reached", and a plain Error loses the status.
  refresh: async (): Promise<AuthResponse> => {
    const response = await apiConnector<AuthResponse>(
      "POST",
      "/auth/refresh",
      undefined,
      undefined,
      undefined,
      undefined,
      { timeout: REFRESH_TIMEOUT_MS },
    );

    return response.data;
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
