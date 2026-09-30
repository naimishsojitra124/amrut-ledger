/**
 * What a ledger line is really worth.
 *
 * A day's amount is stored as whole rupees, so 0.75 L at Rs 54 is kept as 41 rather than
 * 40.50. Reading that stored figure is what put the wrong number on screen for someone to
 * copy onto a customer's card, and adding a month of them billed 1,148 for milk worth
 * 1,134. Everything shown to a person is worked out from litres and the rate instead.
 *
 * Only a bill rounds, and only once, on its own total.
 */

type MilkLine = { litres?: number | null; rate?: number | null };
type ProductLine = { quantity?: number | null; unitPrice?: number | null };
type EntryLike = {
  milkEntries?: MilkLine[] | null;
  productEntries?: ProductLine[] | null;
};

/** Kept to paise, so repeated addition does not drift into 40.500000000001. */
const toPaise = (value: number) => Math.round(value * 100) / 100;

export function milkLineAmount(line: MilkLine): number {
  return toPaise((line.litres ?? 0) * (line.rate ?? 0));
}

export function productLineAmount(line: ProductLine): number {
  return toPaise((line.quantity ?? 0) * (line.unitPrice ?? 0));
}

export function entryAmount(entry: EntryLike): number {
  const milk = (entry.milkEntries ?? []).reduce(
    (sum, line) => sum + milkLineAmount(line),
    0,
  );

  const products = (entry.productEntries ?? []).reduce(
    (sum, line) => sum + productLineAmount(line),
    0,
  );

  return toPaise(milk + products);
}

export function dayAmount(entries: EntryLike[] | null | undefined): number {
  return toPaise(
    (entries ?? []).reduce((sum, entry) => sum + entryAmount(entry), 0),
  );
}
