import { describe, expect, it } from "vitest";

import { deriveBillSettlement, summariseLedgersForBill } from "./bill.service";

const ledger = (entries: unknown[]) => ({ entries });

const milk = (milkTypeId: string, litres: number, rate: number) => ({
  milkEntries: [
    { milkTypeId, milkTypeName: `Milk ${milkTypeId}`, litres, rate, amount: litres * rate },
  ],
});

const product = (itemName: string, quantity: number, unitPrice: number) => ({
  productEntries: [
    { productSuggestionId: null, itemName, quantity, unitPrice, amount: quantity * unitPrice },
  ],
});

describe("summarising a month's ledgers into bill lines", () => {
  it("adds up a milk type across days at the same rate", () => {
    const summary = summariseLedgersForBill([
      ledger([milk("a", 1.5, 54)]),
      ledger([milk("a", 2, 54)]),
    ]);

    expect(summary.milkSummary).toHaveLength(1);
    expect(summary.milkSummary[0]?.litres).toBe(3.5);
    expect(summary.currentCharges).toBe(189);
  });

  it("keeps the same milk type apart when the rate changed mid-month", () => {
    const summary = summariseLedgersForBill([
      ledger([milk("a", 1, 54)]),
      ledger([milk("a", 1, 58)]),
    ]);

    expect(summary.milkSummary).toHaveLength(2);
    expect(summary.currentCharges).toBe(112);
  });

  it("counts product quantities and money separately", () => {
    const summary = summariseLedgersForBill([
      ledger([product("Bread", 2, 30)]),
      ledger([product("Bread", 1, 30)]),
    ]);

    expect(summary.totalItemsCount).toBe(3);
    expect(summary.otherItemsTotal).toBe(90);
  });

  it("reads an empty month as zero rather than failing", () => {
    const summary = summariseLedgersForBill([]);

    expect(summary.currentCharges).toBe(0);
    expect(summary.totalMilkLitres).toBe(0);
    expect(summary.milkSummary).toEqual([]);
  });

  it("ignores a day marked as no purchase, which carries no entries", () => {
    const summary = summariseLedgersForBill([ledger([]), ledger([milk("a", 1, 54)])]);

    expect(summary.currentCharges).toBe(54);
  });
});

describe("what is still owed after a bill's total moves", () => {
  it("leaves an untouched bill unpaid for its full amount", () => {
    expect(deriveBillSettlement(4236, 0)).toEqual({
      outstandingAmount: 4236,
      status: "unpaid",
    });
  });

  it("re-derives the balance when charges are added to a part-paid bill", () => {
    expect(deriveBillSettlement(4400, 2000)).toEqual({
      outstandingAmount: 2400,
      status: "partial",
    });
  });

  it("settles the bill when a correction brings the total down to what was paid", () => {
    expect(deriveBillSettlement(2000, 2000)).toEqual({
      outstandingAmount: 0,
      status: "paid",
    });
  });

  it("never reports a negative balance when the customer has overpaid", () => {
    // The overpayment stays visible as totalPaid > grandTotal; it is not absorbed here.
    expect(deriveBillSettlement(1500, 2000)).toEqual({
      outstandingAmount: 0,
      status: "paid",
    });
  });

  it("calls a zero bill paid, not unpaid", () => {
    expect(deriveBillSettlement(0, 0)).toEqual({ outstandingAmount: 0, status: "paid" });
  });
});
