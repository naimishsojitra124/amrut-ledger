import { describe, expect, it } from "vitest";

import { assertNotDemoAccount } from "@/app/middleware/authorize";
import {
  ASSIGNABLE_ROLES,
  canActOnUser,
  getPermissionsForRole,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  roleHasPermission,
} from "./permissions";

describe("role permissions", () => {
  it("gives the owner everything", () => {
    const everyPermission = Object.values(PERMISSIONS);

    for (const permission of everyPermission) {
      expect(roleHasPermission("owner", permission)).toBe(true);
    }
  });

  it("nests the roles: employee ⊆ manager ⊆ owner", () => {
    for (const permission of getPermissionsForRole("employee")) {
      expect(roleHasPermission("manager", permission)).toBe(true);
    }

    for (const permission of getPermissionsForRole("manager")) {
      expect(roleHasPermission("owner", permission)).toBe(true);
    }
  });

  it("keeps money corrections away from the counter", () => {
    // An employee records what goes out and takes payment for it. Undoing a
    // receipt, moving a deposit or closing off a month is a manager's call.
    const withheld = [
      PERMISSIONS.PAYMENT_REVERSE,
      PERMISSIONS.BILL_GENERATE,
      PERMISSIONS.CUSTOMER_DEPOSIT_MANAGE,
      PERMISSIONS.CUSTOMER_OPENING_BALANCE_MANAGE,
      PERMISSIONS.LEDGER_ENTRY_DELETE,
      PERMISSIONS.MILK_TYPE_MANAGE,
    ];

    for (const permission of withheld) {
      expect(roleHasPermission("employee", permission)).toBe(false);
    }
  });

  it("lets employees do their actual job", () => {
    const granted = [
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_CREATE,
      PERMISSIONS.LEDGER_ENTRY_CREATE,
      PERMISSIONS.LEDGER_ENTRY_UPDATE,
      PERMISSIONS.PAYMENT_RECORD,
      PERMISSIONS.BILL_VIEW,
    ];

    for (const permission of granted) {
      expect(roleHasPermission("employee", permission)).toBe(true);
    }
  });

  it("keeps staff administration with the owner", () => {
    const ownerOnly = [
      PERMISSIONS.USER_CREATE,
      PERMISSIONS.USER_UPDATE,
      PERMISSIONS.USER_CHANGE_ROLE,
      PERMISSIONS.USER_ARCHIVE,
      PERMISSIONS.SYSTEM_JOBS_VIEW,
    ];

    for (const permission of ownerOnly) {
      expect(roleHasPermission("owner", permission)).toBe(true);
      expect(roleHasPermission("manager", permission)).toBe(false);
      expect(roleHasPermission("employee", permission)).toBe(false);
    }
  });

  it("lists no permission twice", () => {
    for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      expect(new Set(permissions).size, `${role} has duplicates`).toBe(permissions.length);
    }
  });
});

// Closes the escalation hole: a manager holds the reset permission but must not reach the owner.
describe("seniority", () => {
  it("stops a manager reaching an owner", () => {
    expect(roleHasPermission("manager", PERMISSIONS.USER_RESET_PASSWORD)).toBe(true);
    expect(canActOnUser("manager", "owner")).toBe(false);
  });

  it("stops a manager reaching another manager", () => {
    expect(canActOnUser("manager", "manager")).toBe(false);
  });

  it("lets a manager administer employees", () => {
    expect(canActOnUser("manager", "employee")).toBe(true);
  });

  it("lets the owner administer anyone", () => {
    expect(canActOnUser("owner", "owner")).toBe(true);
    expect(canActOnUser("owner", "manager")).toBe(true);
    expect(canActOnUser("owner", "employee")).toBe(true);
  });

  it("gives employees no authority over anyone", () => {
    expect(canActOnUser("employee", "owner")).toBe(false);
    expect(canActOnUser("employee", "manager")).toBe(false);
    expect(canActOnUser("employee", "employee")).toBe(false);
  });
});

// Guests get full access on purpose; a throwaway database is what keeps that safe.
describe("guest", () => {
  it("can do everything an owner can", () => {
    for (const permission of Object.values(PERMISSIONS)) {
      expect(roleHasPermission("guest", permission), permission).toBe(true);
    }
  });

  it("can administer the other seeded accounts", () => {
    expect(canActOnUser("guest", "manager")).toBe(true);
    expect(canActOnUser("guest", "employee")).toBe(true);
  });

  it("is not something a real account can be moved to", () => {
    expect(ASSIGNABLE_ROLES).not.toContain("guest");
  });
});

describe("protecting the shared demo account", () => {
  it("refuses any change to it", () => {
    // Renaming, archiving, demoting or resetting the password of the account
    // everyone signs in with would lock out the next visitor.
    expect(() => assertNotDemoAccount({ role: "guest" })).toThrow(
      /shared demo account cannot be changed/,
    );
  });

  it("leaves every other account alone", () => {
    expect(() => assertNotDemoAccount({ role: "owner" })).not.toThrow();
    expect(() => assertNotDemoAccount({ role: "manager" })).not.toThrow();
    expect(() => assertNotDemoAccount({ role: "employee" })).not.toThrow();
  });
});
