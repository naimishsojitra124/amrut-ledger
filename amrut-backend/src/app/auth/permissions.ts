import type { UserRole } from "../../../generated/prisma/enums";

// The single place access is decided; the client is sent the resolved list, never this matrix.
export const PERMISSIONS = {
  // ── Customers ────────────────────────────────────────────────────────────
  CUSTOMER_VIEW: "customer.view",
  CUSTOMER_CREATE: "customer.create",
  CUSTOMER_UPDATE: "customer.update",
  /** Close a customer's account, or reopen a closed one. */
  CUSTOMER_ARCHIVE: "customer.archive",
  /** Top up or refund a deposit — moves real money. */
  CUSTOMER_DEPOSIT_MANAGE: "customer.deposit.manage",
  /** Record or remove the balance brought over from paper records. */
  CUSTOMER_OPENING_BALANCE_MANAGE: "customer.openingBalance.manage",

  // ── Daily ledger ─────────────────────────────────────────────────────────
  LEDGER_VIEW: "ledger.view",
  LEDGER_ENTRY_CREATE: "ledger.entry.create",
  LEDGER_ENTRY_UPDATE: "ledger.entry.update",
  /** Destructive: an entry is money owed, so removal is a correction. */
  LEDGER_ENTRY_DELETE: "ledger.entry.delete",

  // ── Bills ────────────────────────────────────────────────────────────────
  BILL_VIEW: "bill.view",
  /** Closes off a month and carries balances forward. Not reversible. */
  BILL_GENERATE: "bill.generate",

  // ── Payments ─────────────────────────────────────────────────────────────
  PAYMENT_VIEW: "payment.view",
  PAYMENT_RECORD: "payment.record",
  PAYMENT_REVERSE: "payment.reverse",

  // ── Cards ────────────────────────────────────────────────────────────────
  CARD_VIEW: "card.view",
  CARD_MANAGE: "card.manage",
  CARD_ASSIGN: "card.assign",

  // ── Catalogue ────────────────────────────────────────────────────────────
  MILK_TYPE_VIEW: "milkType.view",
  /** Includes changing a rate, which affects every future entry. */
  MILK_TYPE_MANAGE: "milkType.manage",
  PRODUCT_SUGGESTION_VIEW: "productSuggestion.view",
  PRODUCT_SUGGESTION_MANAGE: "productSuggestion.manage",

  // ── Function orders ──────────────────────────────────────────────────────
  FUNCTION_ORDER_VIEW: "functionOrder.view",
  FUNCTION_ORDER_CREATE: "functionOrder.create",
  FUNCTION_ORDER_UPDATE: "functionOrder.update",
  FUNCTION_ORDER_DELETE: "functionOrder.delete",

  // ── Staff accounts ───────────────────────────────────────────────────────
  USER_VIEW: "user.view",
  USER_CREATE: "user.create",
  USER_UPDATE: "user.update",
  USER_CHANGE_ROLE: "user.changeRole",
  USER_ARCHIVE: "user.archive",
  // Only ever safe alongside canActOnUser, which blocks resets on senior accounts.
  USER_RESET_PASSWORD: "user.resetPassword",

  // ── System ───────────────────────────────────────────────────────────────
  SYSTEM_JOBS_VIEW: "system.jobs.view",
  SYSTEM_JOBS_MANAGE: "system.jobs.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Counter staff: record what goes out and take money, but never change rates or undo a payment.
const EMPLOYEE_PERMISSIONS: Permission[] = [
  PERMISSIONS.CUSTOMER_VIEW,
  PERMISSIONS.CUSTOMER_CREATE,

  PERMISSIONS.LEDGER_VIEW,
  PERMISSIONS.LEDGER_ENTRY_CREATE,
  PERMISSIONS.LEDGER_ENTRY_UPDATE,

  PERMISSIONS.BILL_VIEW,

  PERMISSIONS.PAYMENT_VIEW,
  PERMISSIONS.PAYMENT_RECORD,

  PERMISSIONS.CARD_VIEW,

  PERMISSIONS.MILK_TYPE_VIEW,
  PERMISSIONS.PRODUCT_SUGGESTION_VIEW,

  PERMISSIONS.FUNCTION_ORDER_VIEW,
  PERMISSIONS.FUNCTION_ORDER_CREATE,
  PERMISSIONS.FUNCTION_ORDER_UPDATE,
];

// Day-to-day running: corrections, deposits, month end, catalogue and cards.
const MANAGER_PERMISSIONS: Permission[] = [
  ...EMPLOYEE_PERMISSIONS,

  PERMISSIONS.CUSTOMER_UPDATE,
  PERMISSIONS.CUSTOMER_ARCHIVE,
  PERMISSIONS.CUSTOMER_DEPOSIT_MANAGE,
  PERMISSIONS.CUSTOMER_OPENING_BALANCE_MANAGE,

  PERMISSIONS.LEDGER_ENTRY_DELETE,

  PERMISSIONS.BILL_GENERATE,
  PERMISSIONS.PAYMENT_REVERSE,

  PERMISSIONS.CARD_MANAGE,
  PERMISSIONS.CARD_ASSIGN,

  PERMISSIONS.MILK_TYPE_MANAGE,
  PERMISSIONS.PRODUCT_SUGGESTION_MANAGE,

  PERMISSIONS.FUNCTION_ORDER_DELETE,

  PERMISSIONS.USER_VIEW,
  PERMISSIONS.USER_RESET_PASSWORD,
];

// Everything a manager can do, plus staff administration and the scheduler.
const OWNER_PERMISSIONS: Permission[] = [
  ...MANAGER_PERMISSIONS,

  PERMISSIONS.USER_CREATE,
  PERMISSIONS.USER_UPDATE,
  PERMISSIONS.USER_CHANGE_ROLE,
  PERMISSIONS.USER_ARCHIVE,

  PERMISSIONS.SYSTEM_JOBS_VIEW,
  PERMISSIONS.SYSTEM_JOBS_MANAGE,
];

// Full access on purpose: the demo is kept safe by a throwaway database, not a shorter list.
const GUEST_PERMISSIONS: Permission[] = [...OWNER_PERMISSIONS];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  guest: Object.freeze([...new Set(GUEST_PERMISSIONS)]),
  employee: Object.freeze(EMPLOYEE_PERMISSIONS),
  manager: Object.freeze([...new Set(MANAGER_PERMISSIONS)]),
  owner: Object.freeze([...new Set(OWNER_PERMISSIONS)]),
};

// Seniority: nobody may administer an account at or above their own level.
const ROLE_RANK: Record<UserRole, number> = {
  // Ranked alongside an owner so a reviewer can exercise staff management,
  // but never over the demo account itself — see `assertNotDemoAccount`.
  guest: 3,
  employee: 1,
  manager: 2,
  owner: 3,
};

export function getPermissionsForRole(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return getPermissionsForRole(role).includes(permission);
}

// Stops a manager resetting the owner's password and signing in as them.
export function canActOnUser(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === "owner" || actorRole === "guest") return true;
  return ROLE_RANK[actorRole] > ROLE_RANK[targetRole];
}

// guest is excluded: it belongs to the shared demo account and the API refuses to assign it.
export const ASSIGNABLE_ROLES = ["owner", "manager", "employee"] as const;

