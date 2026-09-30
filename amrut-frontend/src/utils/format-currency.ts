export const formatCurrency = (
  amount: number | null | undefined,
  currency: string = "INR",
  locale: string = "en-IN",
) => {
  if (amount === null || amount === undefined) {
    return "₹0";
  }

  // Rounded to paise first, so arithmetic noise like 40.500000000001 does not read as
  // a fractional amount.
  const value = Math.round((Number(amount) || 0) * 100) / 100;

  /**
   * Paise are shown only where they are real.
   *
   * A day of 0.75 L at Rs 54 is 40.50. Printing that as 41 is what sent someone copying
   * the screen onto a customer's card half a rupee out every single day. Whole amounts —
   * every bill total — still read as plain rupees.
   */
  const digits = Number.isInteger(value) ? 0 : 2;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
};

/**
 * The same amounts for a PDF, where the built-in Helvetica has no glyph for "₹".
 *
 * Stored money is whole rupees, so decimals are shown only when an amount actually has
 * them — which happens where a fractional quantity (kg) is multiplied by a whole rate.
 */
export const formatRupees = (amount: number | null | undefined): string => {
  const value = Number(amount) || 0;
  const digits = Number.isInteger(value) ? 0 : 2;

  return `${value < 0 ? "-" : ""}Rs. ${Math.abs(value).toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
};
