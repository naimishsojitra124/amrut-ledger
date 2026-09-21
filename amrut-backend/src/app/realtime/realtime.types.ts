import { PERMISSIONS, type Permission } from "@/app/auth/permissions";
import type { UserRole } from "../../../generated/prisma/enums";

export const REALTIME_RESOURCES = [
  "customer",
  "customer-deposit",
  "opening-balance",
  "daily-ledger",
  "bill",
  "payment",
  "card",
  "function-order",
  "milk-type",
  "product-suggestion",
  "user",
  "system-job",
] as const;

export type RealtimeResource = (typeof REALTIME_RESOURCES)[number];

export type RealtimeAction = "created" | "updated" | "deleted";

export type RealtimePhase = "started" | "success" | "error";

// A subscriber only receives a record it could have fetched itself. Without this the
// socket would hand every connected device data its role is not allowed to read.
export const RESOURCE_VIEW_PERMISSION: Record<RealtimeResource, Permission> = {
  customer: PERMISSIONS.CUSTOMER_VIEW,
  "customer-deposit": PERMISSIONS.CUSTOMER_VIEW,
  "opening-balance": PERMISSIONS.CUSTOMER_VIEW,
  "daily-ledger": PERMISSIONS.LEDGER_VIEW,
  bill: PERMISSIONS.BILL_VIEW,
  payment: PERMISSIONS.PAYMENT_VIEW,
  card: PERMISSIONS.CARD_VIEW,
  "function-order": PERMISSIONS.FUNCTION_ORDER_VIEW,
  "milk-type": PERMISSIONS.MILK_TYPE_VIEW,
  "product-suggestion": PERMISSIONS.PRODUCT_SUGGESTION_VIEW,
  user: PERMISSIONS.USER_VIEW,
  "system-job": PERMISSIONS.SYSTEM_JOBS_VIEW,
};

const PHASE_SUFFIX: Record<RealtimeAction, Record<RealtimePhase, string>> = {
  created: {
    started: "creation_started",
    success: "created_successfully",
    error: "creation_error",
  },
  updated: {
    started: "update_started",
    success: "updated_successfully",
    error: "update_error",
  },
  deleted: {
    started: "deletion_started",
    success: "deleted_successfully",
    error: "deletion_error",
  },
};

// e.g. customer + created + success -> "customer_created_successfully"
export function realtimeEventType(
  resource: RealtimeResource,
  action: RealtimeAction,
  phase: RealtimePhase,
): string {
  return `${resource.replaceAll("-", "_")}_${PHASE_SUFFIX[action][phase]}`;
}

export interface RealtimeActor {
  id: string;
  role: UserRole;
  fullName: string | null;
}

export interface RealtimeChange {
  resource: RealtimeResource;
  action: RealtimeAction;
  entityId?: string | undefined;
  customerId?: string | undefined;
}

export interface RealtimeChangeEvent extends RealtimeChange {
  kind: "change";
  type: string;
  phase: RealtimePhase;
  id: string;
  at: string;
  requestId: string;
  method: string;
  // The concrete path that caused it, plus the route pattern it matched.
  url: string;
  route: string;
  status: number | null;
  actor: RealtimeActor | null;
  // The server's own response body. Absent when the subscriber may not read this
  // resource, or when the body was too large to be worth pushing; the client then
  // falls back to refetching.
  data?: unknown;
  error?: { message: string } | null;
}

export type RealtimeServerFrame =
  | RealtimeChangeEvent
  | { kind: "ready"; connectionId: string; at: string }
  | { kind: "error"; code: string; message: string };

export interface RealtimeAuthFrame {
  type: "auth";
  token: string;
  clientId?: string | undefined;
}
