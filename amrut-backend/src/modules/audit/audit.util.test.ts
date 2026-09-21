import { describe, expect, it } from "vitest";

import {
  change,
  collectChanges,
  describeLedgerEntry,
  describeMilkType,
  describeMilkTypeList,
  formatBillPeriod,
  formatMoney,
  moneyChange,
} from "./audit.util";

describe("audit log formatting", () => {
  it("never puts an identifier or a raw number in front of the user", () => {
    const entry = describeLedgerEntry({
      milkEntries: [
        { milkTypeName: "Buffalo 54", litres: 2.5, rate: 54, amount: 135 },
      ],
      productEntries: [{ itemName: "Bread", quantity: 2, unitPrice: 40, amount: 80 }],
      totalAmount: 215,
    });

    expect(entry).toBe(
      "2.5 L Buffalo 54 at Rs. 54/L = Rs. 135; 2 x Bread at Rs. 40 = Rs. 80 (total Rs. 215)",
    );

    expect(entry).not.toMatch(/milkTypeId|productSuggestionId|[0-9a-f]{24}/);
  });

  it("includes entry notes and survives empty entries", () => {
    expect(
      describeLedgerEntry({ milkEntries: [], productEntries: [], notes: "Left at gate" }),
    ).toBe("Note: Left at gate");

    expect(describeLedgerEntry(null)).toBe("");
    expect(describeLedgerEntry(undefined)).toBe("");
  });

  it("formats money as whole rupees with Indian grouping", () => {
    expect(formatMoney(1250)).toBe("Rs. 1,250");
    expect(formatMoney(100000)).toBe("Rs. 1,00,000");
    expect(formatMoney(0)).toBe("Rs. 0");
    expect(formatMoney(null)).toBe("");
    expect(formatMoney(undefined)).toBe("");
  });

  it("describes milk types by name and rate rather than by id", () => {
    expect(describeMilkType({ name: "Cow 58", rate: 58 })).toBe("Cow 58 at Rs. 58/L");
    expect(describeMilkType(null)).toBe("");
    expect(describeMilkTypeList([])).toBe("None");
    expect(
      describeMilkTypeList([
        { name: "Buffalo 54", rate: 54 },
        { name: "Cow 58", rate: 58 },
      ]),
    ).toBe("Buffalo 54 at Rs. 54/L, Cow 58 at Rs. 58/L");
  });

  it("drops rows where nothing actually changed", () => {
    const changes = collectChanges([
      change("Name", "Raj Patel", "Raj Patel"),
      change("Mobile number", "Not provided", "9876543210"),
      moneyChange("Deposit balance", 500, 500),
      moneyChange("Outstanding", 1000, 250),
    ]);

    expect(changes).toEqual([
      { field: "Mobile number", oldValue: "Not provided", newValue: "9876543210" },
      { field: "Outstanding", oldValue: "Rs. 1,000", newValue: "Rs. 250" },
    ]);
  });

  it("names the billing period in words", () => {
    expect(formatBillPeriod(3, 2026)).toBe("March 2026");
    expect(formatBillPeriod(12, 2025)).toBe("December 2025");
  });
});
