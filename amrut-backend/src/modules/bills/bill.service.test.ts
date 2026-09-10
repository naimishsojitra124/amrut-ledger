import { describe, expect, it } from "vitest";
import { getDepositCredit } from "./bill.service";

describe("getDepositCredit", () => {
  it("uses only the available deposit and never more than the bill balance", () => {
    expect(getDepositCredit(3571, 2000, 1571, true)).toBe(2000);
    expect(getDepositCredit(1753, 1000, 753, true)).toBe(1000);
    expect(getDepositCredit(814, 1500, 0, true)).toBe(814);
    expect(getDepositCredit(1000, 2000, 1000, false)).toBe(0);
  });
});
