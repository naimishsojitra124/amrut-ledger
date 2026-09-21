import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertOpeningBalancePeriod,
  buildOpeningBalanceBill,
  getOpeningBalanceBillNumber,
} from "./customer.service";

// Stored as an ordinary bill, so every outstanding total handles it with no special case.
describe("opening balance", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const build = (amount: number, month = 8, year = 2026) =>
    buildOpeningBalanceBill({
      customerId: "customer-1",
      cardAssignmentId: "assignment-1",
      cardNumber: 47,
      amount,
      month,
      year,
      notes: "Carried over from the register",
      performedById: "user-1",
    });

  it("is a real receivable: fully outstanding and unpaid", () => {
    const bill = build(4500);

    expect(bill.grandTotal).toBe(4500);
    expect(bill.outstandingAmount).toBe(4500);
    expect(bill.totalPaid).toBe(0);
    expect(bill.status).toBe("unpaid");
    expect(bill.isOpeningBalance).toBe(true);
  });

  it("records the amount as a previous due, not as current charges", () => {
    const bill = build(4500);

    expect(bill.previousDue).toBe(4500);
    expect(bill.otherItemsTotal).toBe(0);
    expect(bill.totalMilkLitres).toBe(0);
    expect(bill.milkSummary).toEqual([]);
    expect(bill.otherItems).toEqual([]);
    expect(bill.totalItemsCount).toBe(0);
  });

  it("stores whole rupees", () => {
    expect(build(1250.6).grandTotal).toBe(1251);
    expect(build(1250.4).outstandingAmount).toBe(1250);
  });

  it("dates itself to the end of the period it covers", () => {
    const bill = build(1000, 8, 2026);

    expect(bill.billDate.toISOString()).toBe("2026-08-31T00:00:00.000Z");
    expect(bill.dueDate.toISOString()).toBe("2026-09-10T00:00:00.000Z");
  });

  it("uses a bill number that is distinguishable from a generated bill", () => {
    expect(getOpeningBalanceBillNumber(8, 2026, 47)).toBe("OPEN-08-2026-47");
    expect(getOpeningBalanceBillNumber(12, 2025, 3)).toBe("OPEN-12-2025-3");
  });

  describe("period validation", () => {
    it("accepts the current month and earlier", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-19T10:00:00.000Z"));

      expect(() => assertOpeningBalancePeriod(9, 2026)).not.toThrow();
      expect(() => assertOpeningBalancePeriod(8, 2026)).not.toThrow();
      expect(() => assertOpeningBalancePeriod(12, 2025)).not.toThrow();
    });

    it("rejects a future period, which could never be carried forward", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-19T10:00:00.000Z"));

      expect(() => assertOpeningBalancePeriod(10, 2026)).toThrow(
        /cannot be dated in the future/,
      );
      expect(() => assertOpeningBalancePeriod(1, 2027)).toThrow(
        /cannot be dated in the future/,
      );
    });
  });
});
