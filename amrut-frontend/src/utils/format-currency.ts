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