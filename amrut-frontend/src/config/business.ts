// One source for the details printed on bills, receipts and function orders. `address` is
// the single line those documents already print; the yard's full postal address carries an
// extra "Beside Lakh no Banglow" line that has never appeared on them.
export const BUSINESS_DETAILS = {
  name: "Amrut Dairy Farm",
  address: "Gandhigram, 80ft Road, Rajkot, Gujarat",
};

export const BUSINESS_TIME_ZONE = "Asia/Kolkata";

// Today as the app stores a ledger date: the yyyy-mm-dd business day, in shop time rather
// than the device's. "en-CA" is the shortest locale that formats as yyyy-mm-dd.
export function businessToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
  }).format(new Date());
}

// The month whose bills are being collected. Bills go out on the last day of a month and
// are settled through the first half of the next one, so for most of the month the figures
// worth seeing are the previous month's, not the one that has barely started.
export function previousBusinessMonth(): { month: number; year: number } {
  const [year = 0, month = 1] = businessToday().split("-").map(Number);

  return month === 1
    ? { month: 12, year: year - 1 }
    : { month: month - 1, year };
}

export function formatBusinessMonth({
  month,
  year,
}: {
  month: number;
  year: number;
}) {
  return new Date(year, month - 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}
