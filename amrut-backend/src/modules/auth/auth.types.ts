import type { UserRole, UserStatus } from "../../../generated/prisma/enums";
import type { Permission } from "@/app/auth/permissions";

export interface LoginRequest {
  mobileNumber: string;
  password: string;
}

export interface AuthUser {
  id: string;
  fullName: string;
  mobileNumber: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  permissions: Permission[];
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
}

export interface MeResponse {
  user: AuthUser;
}

export interface RefreshResponse {
  user: AuthUser;
  accessToken: string;
}

export interface LogoutResponse {
  success: true;
}

export interface JwtSessionPayload {
  sub: string;
  role: UserRole;
  tokenType: "access" | "refresh";
  sid?: string;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}
