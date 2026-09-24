export const formatCurrency = (
  amount: number | null | undefined,
  currency: string = "INR",
  locale: string = "en-IN"
) => {
  if (amount === null || amount === undefined) {
    return "₹0";
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
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
