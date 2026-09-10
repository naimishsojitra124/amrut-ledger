export type UserRole = "owner" | "manager" | "employee";

export type UserStatus = "active" | "inactive";

export interface User {
  _id: string;

  fullName: string;

  mobileNumber: string;

  role: UserRole;

  status: UserStatus;

  lastLoginAt: Date;

  createdAt: Date;
  updatedAt: Date;
}