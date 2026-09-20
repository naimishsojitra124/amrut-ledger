import type { UserRole } from "../../../generated/prisma/enums";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  WHO CAN DO WHAT
 * ────────────────────────────────────────────────────────────────────────────
 *
 * This file is the single place access is decided. Change `ROLE_PERMISSIONS`
 * below and both the API and the UI follow — the frontend does not keep its own
 * copy, it receives the signed-in user's permissions from the server, so the
 * two can never drift apart.
 *
 * The API is what actually enforces this. The UI hides buttons a user cannot
 * use, but that is only courtesy: every route re-checks for itself.
 *
 * Shape of a permission name: `<area>.<action>`. Add a new one to `PERMISSIONS`
 * first, then grant it to the roles that should have it.
 */

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
  /**
   * Set someone else's password without knowing the current one.
   *
   * Always paired with the seniority rule in `canActOnUser`: holding this
   * permission never lets you reach an account at or above your own level.
   * Without that pairing, a manager could set the owner's password and then
   * sign in as them.
   */
  USER_RESET_PASSWORD: "user.resetPassword",

  // ── System ───────────────────────────────────────────────────────────────
  SYSTEM_JOBS_VIEW: "system.jobs.view",
  SYSTEM_JOBS_MANAGE: "system.jobs.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Employees run the counter: they serve customers, record what goes out and
 * take money for it. They do not change rates, close months, or undo anything
 * that has already been recorded as money received.
 */
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

/**
 * Managers run the shop day to day: they correct mistakes, move deposits,
 * close months and look after the catalogue and the cards.
 *
 * They can reset an employee's password but — by the seniority rule — never an
 * owner's or another manager's.
 */
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

/** The owner can do everything, including managing staff accounts. */
const OWNER_PERMISSIONS: Permission[] = [
  ...MANAGER_PERMISSIONS,

  PERMISSIONS.USER_CREATE,
  PERMISSIONS.USER_UPDATE,
  PERMISSIONS.USER_CHANGE_ROLE,
  PERMISSIONS.USER_ARCHIVE,

  PERMISSIONS.SYSTEM_JOBS_VIEW,
  PERMISSIONS.SYSTEM_JOBS_MANAGE,
];

/**
 * The public demo account gets everything an owner does, so a reviewer can
 * exercise the whole app rather than bumping into refusals.
 *
 * Two things make that safe, and neither lives in this list:
 *
 *   1. The demo runs on its own database, wiped and re-seeded on a schedule —
 *      see `modules/demo/demo-reset.service.ts`.
 *   2. The demo account itself is protected from being renamed, archived,
 *      demoted or locked out, so no visitor can close the door behind them —
 *      see `assertNotDemoAccount` in `middleware/authorize.ts`.
 */
const GUEST_PERMISSIONS: Permission[] = [...OWNER_PERMISSIONS];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  guest: Object.freeze([...new Set(GUEST_PERMISSIONS)]),
  employee: Object.freeze(EMPLOYEE_PERMISSIONS),
  manager: Object.freeze([...new Set(MANAGER_PERMISSIONS)]),
  owner: Object.freeze([...new Set(OWNER_PERMISSIONS)]),
};

/**
 * Seniority, used to stop anyone acting on an account at or above their own
 * level. Higher number wins.
 */
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

/**
 * Whether `actorRole` may administer an account held by `targetRole`.
 *
 * Only the owner can act on another owner, and only on themselves — see
 * `isSelf` handling at the call site. Everyone else must be strictly senior to
 * the account they are touching, which is what prevents a manager from taking
 * over the owner's login by resetting its password.
 */
export function canActOnUser(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === "owner" || actorRole === "guest") return true;
  return ROLE_RANK[actorRole] > ROLE_RANK[targetRole];
}

/** Staff roles, i.e. everything a real person can be assigned. */
export const ASSIGNABLE_ROLES = ["owner", "manager", "employee"] as const;

export function isGuestRole(role: UserRole): boolean {
  return role === "guest";
}

export function describeRole(role: UserRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}
