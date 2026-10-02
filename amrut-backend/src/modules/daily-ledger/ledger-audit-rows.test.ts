import { describe, expect, it, vi } from "vitest";

import { createAuditLog } from "./daily-ledger.service";

/**
 * Ledger rows are the most numerous thing in this database — one per customer per day —
 * so what each one stores is worth holding still. These guard the two ways a row used to
 * carry nothing: a "Ledger date" change whose old value was always empty and whose new
 * value was already in the title, and an edit that left the entry exactly as it was.
 */

function makePrisma() {
  const create = vi.fn().mockResolvedValue({});
  return { prisma: { auditLog: { create } } as never, create };
}

const ENTRY = {
  milkEntries: [{ milkTypeName: "Buffalo", litres: 1, rate: 58, amount: 58 }],
  productEntries: [],
  totalAmount: 58,
};

const BASE = {
  customerId: "customer-1",
  performedById: "user-1",
  type: "entry_added" as const,
  title: "Ledger entry added for 01 Sept 2026",
  ledgerId: "ledger-1",
};

describe("what a ledger audit row stores", () => {
  it("records the entry itself and nothing else", async () => {
    const { prisma, create } = makePrisma();

    await createAuditLog(prisma, { ...BASE, newEntry: ENTRY });

    const { data } = create.mock.calls[0]![0] as { data: { details: unknown[] } };

    expect(data.details).toEqual([
      {
        field: "Entry",
        oldValue: "None",
        newValue: "1 L Buffalo at Rs. 58/L = Rs. 58 (total Rs. 58)",
      },
    ]);
  });

  it("does not repeat the date, which the title already carries", async () => {
    const { prisma, create } = makePrisma();

    await createAuditLog(prisma, { ...BASE, newEntry: ENTRY });

    const { data } = create.mock.calls[0]![0] as {
      data: { title: string; details: { field: string }[] };
    };

    expect(data.details.map((change) => change.field)).not.toContain("Ledger date");
    expect(data.title).toContain("01 Sept 2026");
  });

  it("stores no change at all when the entry did not move", async () => {
    const { prisma, create } = makePrisma();

    // Toggling "no purchase" has no entry on either side; the title is the whole story.
    await createAuditLog(prisma, {
      ...BASE,
      type: "entry_updated",
      title: "Marked as no purchase for 04 Sept 2026",
    });

    const { data } = create.mock.calls[0]![0] as { data: { details: unknown[] } };

    expect(data.details).toEqual([]);
  });

  it("writes nothing for an edit that changed nothing", async () => {
    const { prisma, create } = makePrisma();

    await createAuditLog(prisma, {
      ...BASE,
      type: "entry_updated",
      title: "Ledger entry updated for 01 Sept 2026",
      oldEntry: ENTRY,
      newEntry: { ...ENTRY },
      onlyIfChanged: true,
    });

    expect(create).not.toHaveBeenCalled();
  });

  it("still writes when an edit did change something", async () => {
    const { prisma, create } = makePrisma();

    await createAuditLog(prisma, {
      ...BASE,
      type: "entry_updated",
      title: "Ledger entry updated for 01 Sept 2026",
      oldEntry: ENTRY,
      newEntry: {
        ...ENTRY,
        milkEntries: [{ milkTypeName: "Buffalo", litres: 2, rate: 58, amount: 116 }],
        totalAmount: 116,
      },
      onlyIfChanged: true,
    });

    expect(create).toHaveBeenCalledTimes(1);

    const { data } = create.mock.calls[0]![0] as {
      data: { details: { oldValue: string; newValue: string }[] };
    };

    expect(data.details[0]!.oldValue).toContain("1 L Buffalo");
    expect(data.details[0]!.newValue).toContain("2 L Buffalo");
  });
});
