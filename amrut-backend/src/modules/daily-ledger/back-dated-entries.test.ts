import { describe, expect, it, vi } from "vitest";

import { getAssignmentForLedgerDateOrThrow } from "./daily-ledger.service";

const ASSIGNMENT_IN_EFFECT = { id: "assignment-current", cardId: "card-2" };
const EARLIEST_ASSIGNMENT = { id: "assignment-first", cardId: "card-1" };

function makePrisma(results: unknown[]) {
  const findFirst = vi.fn();
  for (const result of results) findFirst.mockResolvedValueOnce(result);

  return {
    prisma: { cardAssignment: { findFirst } } as never,
    findFirst,
  };
}

// The card in effect that day, else the earliest the customer has ever held.
describe("resolving the card assignment for a ledger date", () => {
  it("uses the card the customer held that day", async () => {
    const { prisma, findFirst } = makePrisma([ASSIGNMENT_IN_EFFECT]);

    const assignment = await getAssignmentForLedgerDateOrThrow(
      prisma,
      "customer-1",
      "2026-09-15",
    );

    expect(assignment).toBe(ASSIGNMENT_IN_EFFECT);
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it("falls back to the earliest card when the date predates every assignment", async () => {
    const { prisma, findFirst } = makePrisma([null, EARLIEST_ASSIGNMENT]);

    const assignment = await getAssignmentForLedgerDateOrThrow(
      prisma,
      "customer-1",
      "2026-09-01",
    );

    expect(assignment).toBe(EARLIEST_ASSIGNMENT);
    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  it("refuses only when the customer has never held a card", async () => {
    const { prisma } = makePrisma([null, null]);

    await expect(
      getAssignmentForLedgerDateOrThrow(prisma, "customer-1", "2026-09-01"),
    ).rejects.toThrow(/Assign a card to this customer/);
  });

  it("searches the day the entry is for, not the day it is written", async () => {
    const { prisma, findFirst } = makePrisma([ASSIGNMENT_IN_EFFECT]);

    await getAssignmentForLedgerDateOrThrow(prisma, "customer-1", "2026-09-15");

    const where = findFirst.mock.calls[0]?.[0]?.where;

    expect(where.customerId).toBe("customer-1");
    expect(where.assignedAt.lte.toISOString()).toBe("2026-09-16T00:00:00.000Z");
    expect(where.OR).toEqual([
      { unassignedAt: null },
      { unassignedAt: { gt: new Date("2026-09-15T00:00:00.000Z") } },
    ]);
  });
});
