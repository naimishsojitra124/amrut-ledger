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
