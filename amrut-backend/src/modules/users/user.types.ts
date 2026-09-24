import type { UserRole, UserStatus } from "../../../generated/prisma/enums";

export interface PageInfo {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface UserResponse {
  id: string;
  fullName: string;
  mobileNumber: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserListResponse {
  items: UserResponse[];
  pageInfo: PageInfo;
}

export interface UserStatsResponse {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  ownerCount: number;
  managerCount: number;
  employeeCount: number;
}

export interface CreateUserRequest {
  fullName: string;
  mobileNumber: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserRequest {
  fullName: string;
  mobileNumber: string;
  email: string;
}

export interface ChangeUserPasswordRequest {
  password: string;
}

export interface ChangeUserRoleRequest {
  role: UserRole;
}

export interface UserListQuery {
  page: number;
  limit: number;
  search?: string | undefined;
  status?: "active" | "inactive" | undefined;
  role?: UserRole | undefined;
}