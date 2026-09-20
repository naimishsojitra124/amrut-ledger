/**
 * Permission names, mirrored from the API.
 *
 * ⚠️ Who gets what is decided on the server, in
 * `amrut-backend/src/app/auth/permissions.ts`. That file is the only place to
 * change access. This one just names the permissions so the UI can refer to
 * them without string literals scattered through components — the actual list
 * for the signed-in user arrives with their profile.
 *
 * Hiding a control here is courtesy, not security. The API re-checks every
 * request regardless of what the UI chose to show.
 */
export const PERMISSIONS = {
  CUSTOMER_VIEW: "customer.view",
  CUSTOMER_CREATE: "customer.create",
  CUSTOMER_UPDATE: "customer.update",
  CUSTOMER_ARCHIVE: "customer.archive",
  CUSTOMER_DEPOSIT_MANAGE: "customer.deposit.manage",
  CUSTOMER_OPENING_BALANCE_MANAGE: "customer.openingBalance.manage",

  LEDGER_VIEW: "ledger.view",
  LEDGER_ENTRY_CREATE: "ledger.entry.create",
  LEDGER_ENTRY_UPDATE: "ledger.entry.update",
  LEDGER_ENTRY_DELETE: "ledger.entry.delete",

  BILL_VIEW: "bill.view",
  BILL_GENERATE: "bill.generate",

  PAYMENT_VIEW: "payment.view",
  PAYMENT_RECORD: "payment.record",
  PAYMENT_REVERSE: "payment.reverse",

  CARD_VIEW: "card.view",
  CARD_MANAGE: "card.manage",
  CARD_ASSIGN: "card.assign",

  MILK_TYPE_VIEW: "milkType.view",
  MILK_TYPE_MANAGE: "milkType.manage",
  PRODUCT_SUGGESTION_VIEW: "productSuggestion.view",
  PRODUCT_SUGGESTION_MANAGE: "productSuggestion.manage",

  FUNCTION_ORDER_VIEW: "functionOrder.view",
  FUNCTION_ORDER_CREATE: "functionOrder.create",
  FUNCTION_ORDER_UPDATE: "functionOrder.update",
  FUNCTION_ORDER_DELETE: "functionOrder.delete",

  USER_VIEW: "user.view",
  USER_CREATE: "user.create",
  USER_UPDATE: "user.update",
  USER_CHANGE_ROLE: "user.changeRole",
  USER_ARCHIVE: "user.archive",
  USER_RESET_PASSWORD: "user.resetPassword",

  SYSTEM_JOBS_VIEW: "system.jobs.view",
  SYSTEM_JOBS_MANAGE: "system.jobs.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type UserRole = "owner" | "manager" | "employee" | "guest";

/** Pages a user can reach, and the permission each one needs. */
export const ROUTE_PERMISSIONS = {
  "/dashboard": null,
  "/customers": PERMISSIONS.CUSTOMER_VIEW,
  "/quick-entry": PERMISSIONS.LEDGER_ENTRY_CREATE,
  "/bills": PERMISSIONS.BILL_VIEW,
  "/function-orders": PERMISSIONS.FUNCTION_ORDER_VIEW,
  "/settings": null,
} as const satisfies Record<string, Permission | null>;
