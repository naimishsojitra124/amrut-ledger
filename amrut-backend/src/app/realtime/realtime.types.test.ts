import { describe, expect, it } from "vitest";

import { roleHasPermission } from "@/app/auth/permissions";

import {
  REALTIME_RESOURCES,
  RESOURCE_VIEW_PERMISSION,
  realtimeEventType,
} from "./realtime.types";

describe("realtimeEventType", () => {
  it("names the three phases of a creation", () => {
    expect(realtimeEventType("customer", "created", "started")).toBe(
      "customer_creation_started",
    );
    expect(realtimeEventType("customer", "created", "success")).toBe(
      "customer_created_successfully",
    );
    expect(realtimeEventType("customer", "created", "error")).toBe(
      "customer_creation_error",
    );
  });

  it("names updates and deletions the same way", () => {
    expect(realtimeEventType("bill", "updated", "success")).toBe("bill_updated_successfully");
    expect(realtimeEventType("bill", "deleted", "error")).toBe("bill_deletion_error");
  });

  it("turns a hyphenated resource into one readable token", () => {
    expect(realtimeEventType("daily-ledger", "created", "success")).toBe(
      "daily_ledger_created_successfully",
    );
    expect(realtimeEventType("function-order", "deleted", "started")).toBe(
      "function_order_deletion_started",
    );
  });

  it("produces a distinct name for every resource and phase", () => {
    const names = new Set<string>();

    for (const resource of REALTIME_RESOURCES) {
      for (const action of ["created", "updated", "deleted"] as const) {
        for (const phase of ["started", "success", "error"] as const) {
          names.add(realtimeEventType(resource, action, phase));
        }
      }
    }

    expect(names.size).toBe(REALTIME_RESOURCES.length * 9);
  });
});

// A missing entry here would mean a record broadcast with no permission check at all.
describe("RESOURCE_VIEW_PERMISSION", () => {
  it("covers every resource that can be broadcast", () => {
    for (const resource of REALTIME_RESOURCES) {
      expect(RESOURCE_VIEW_PERMISSION[resource]).toBeTruthy();
    }
  });

  it("keeps a record away from a role that could not have fetched it", () => {
    expect(roleHasPermission("employee", RESOURCE_VIEW_PERMISSION.user)).toBe(false);
    expect(roleHasPermission("owner", RESOURCE_VIEW_PERMISSION.user)).toBe(true);
  });
});
