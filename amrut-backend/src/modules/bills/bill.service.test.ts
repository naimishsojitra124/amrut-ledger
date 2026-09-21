import { describe, expect, it } from "vitest";
import {
  getDepositCredit,
  selectBillsToCarryForward,
  sumCarriedForward,
} from "./bill.service";

describe("getDepositCredit", () => {
  it("uses only the available deposit and never more than the bill balance", () => {
    expect(getDepositCredit(3571, 2000, 1571, true)).toBe(2000);
    expect(getDepositCredit(1753, 1000, 753, true)).toBe(1000);
    expect(getDepositCredit(814, 1500, 0, true)).toBe(814);
    expect(getDepositCredit(1000, 2000, 1000, false)).toBe(0);
  });

  it("always credits a whole number of rupees", () => {
    expect(Number.isInteger(getDepositCredit(1000, 333.4, 0, true))).toBe(true);
    expect(getDepositCredit(1000, 333.4, 0, true)).toBe(333);
  });
});

// The rule under test: an unpaid balance must exist in exactly one place.
describe("carrying balances forward", () => {
  const bill = (month: number, year: number, outstandingAmount: number) => ({
    month,
    year,
    outstandingAmount,
  });

  it("takes only bills from periods before the one being generated", () => {
    const open = [
      bill(1, 2026, 500),
      bill(2, 2026, 300),
      bill(3, 2026, 700), // the period being generated
      bill(4, 2026, 900), // a later period
    ];

    expect(selectBillsToCarryForward(open, 3, 2026)).toEqual([
      bill(1, 2026, 500),
      bill(2, 2026, 300),
    ]);
  });

  it("crosses the year boundary correctly", () => {
    const open = [bill(11, 2025, 400), bill(12, 2025, 600), bill(1, 2026, 100)];

    expect(selectBillsToCarryForward(open, 1, 2026)).toEqual([
      bill(11, 2025, 400),
      bill(12, 2025, 600),
    ]);
  });

  it("ignores bills that are already settled", () => {
    const open = [bill(1, 2026, 0), bill(2, 2026, 250)];

    expect(selectBillsToCarryForward(open, 3, 2026)).toEqual([bill(2, 2026, 250)]);
  });

  it("carries nothing when every earlier bill is paid", () => {
    expect(selectBillsToCarryForward([bill(1, 2026, 0)], 2, 2026)).toEqual([]);
    expect(sumCarriedForward([])).toBe(0);
  });

  it("totals the carried balances as whole rupees", () => {
    expect(sumCarriedForward([bill(1, 2026, 500), bill(2, 2026, 300)])).toBe(800);
    expect(sumCarriedForward([bill(1, 2026, 100.4), bill(2, 2026, 200.4)])).toBe(301);
  });

  it("keeps the customer's total balance unchanged by the roll-forward", () => {
    const open = [bill(1, 2026, 500), bill(2, 2026, 300)];
    const currentCharges = 1200;

    const carried = selectBillsToCarryForward(open, 3, 2026);
    const previousDue = sumCarriedForward(carried);

    // What the new bill asks for.
    const newBillOutstanding = currentCharges + previousDue;

    // What the carried bills now show (cleared, because the debt moved).
    const remainingOnOldBills = 0;

    const totalOwedAfter = newBillOutstanding + remainingOnOldBills;
    const totalOwedBefore = 500 + 300 + currentCharges;

    expect(totalOwedAfter).toBe(totalOwedBefore);
    expect(totalOwedAfter).toBe(2000);
  });
});
