/**
 * Audit logs are read by shop staff, not by developers.
 *
 * Everything written through these helpers must therefore be phrased the way
 * it would be said out loud: "Card number", not `cardId`; "Rs. 1,250", not
 * `1250`; "Buffalo 54 at Rs. 54/L", not an ObjectId or a JSON blob. Nothing in
 * an audit detail should ever be a database identifier — the ids that a
 * developer needs live on the log row itself (`relatedEntityType` /
 * `relatedEntityId`), not in the text the user sees.
 */

export interface AuditChange {
  field: string;
  oldValue: string;
  newValue: string;
}

const RUPEE_FORMATTER = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

const LITRE_FORMATTER = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
});

/** Money is always whole rupees. */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return `Rs. ${RUPEE_FORMATTER.format(Math.round(value))}`;
}

export function formatLitres(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return `${LITRE_FORMATTER.format(value)} L`;
}

export function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return LITRE_FORMATTER.format(value);
}

export function formatText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  return String(value).trim();
}

/**
 * A single before/after row. Rows where nothing actually changed are dropped by
 * `collectChanges`, so callers can list every field they touched.
 */
export function change(field: string, oldValue: unknown, newValue: unknown): AuditChange {
  return {
    field,
    oldValue: formatText(oldValue),
    newValue: formatText(newValue),
  };
}

export function moneyChange(
  field: string,
  oldValue: number | null | undefined,
  newValue: number | null | undefined,
): AuditChange {
  return {
    field,
    oldValue: formatMoney(oldValue),
    newValue: formatMoney(newValue),
  };
}

/** Drops no-op rows so an "updated" log only lists what really moved. */
export function collectChanges(changes: AuditChange[]): AuditChange[] {
  return changes.filter((entry) => entry.oldValue !== entry.newValue);
}

export interface AuditMilkEntry {
  milkTypeName?: string | null | undefined;
  litres?: number | null | undefined;
  rate?: number | null | undefined;
  amount?: number | null | undefined;
}

export interface AuditProductEntry {
  itemName?: string | null | undefined;
  quantity?: number | null | undefined;
  unitPrice?: number | null | undefined;
  amount?: number | null | undefined;
}

/** A milk type as it should read in an audit entry. */
export interface AuditMilkTypeRef {
  name?: string | null | undefined;
  rate?: number | null | undefined;
}

/** "2.5 L Buffalo 54 at Rs. 54/L = Rs. 135" */
export function describeMilkEntry(entry: AuditMilkEntry): string {
  const name = formatText(entry.milkTypeName) || "Milk";
  const parts = [`${formatLitres(entry.litres)} ${name}`.trim()];

  if (entry.rate != null) parts.push(`at ${formatMoney(entry.rate)}/L`);
  if (entry.amount != null) parts.push(`= ${formatMoney(entry.amount)}`);

  return parts.join(" ");
}

/** "2 x Bread at Rs. 40 = Rs. 80" */
export function describeProductEntry(entry: AuditProductEntry): string {
  const name = formatText(entry.itemName) || "Item";
  const parts = [`${formatQuantity(entry.quantity)} x ${name}`.trim()];

  if (entry.unitPrice != null) parts.push(`at ${formatMoney(entry.unitPrice)}`);
  if (entry.amount != null) parts.push(`= ${formatMoney(entry.amount)}`);

  return parts.join(" ");
}

export interface AuditLedgerEntry {
  milkEntries?: AuditMilkEntry[] | null | undefined;
  productEntries?: AuditProductEntry[] | null | undefined;
  notes?: string | null | undefined;
  totalAmount?: number | null | undefined;
}

/**
 * A ledger entry rendered as one readable line, e.g.
 * "2.5 L Buffalo 54 at Rs. 54/L = Rs. 135; 1 x Bread at Rs. 40 = Rs. 40 (total Rs. 175)"
 *
 * This replaces `JSON.stringify(entry)`, which put raw ObjectIds and internal
 * field names in front of the user.
 */
export function describeLedgerEntry(entry: AuditLedgerEntry | null | undefined): string {
  if (!entry) return "";

  const lines = [
    ...(entry.milkEntries ?? []).map(describeMilkEntry),
    ...(entry.productEntries ?? []).map(describeProductEntry),
  ].filter(Boolean);

  const notes = formatText(entry.notes);
  if (notes) lines.push(`Note: ${notes}`);

  const body = lines.join("; ");
  const total = entry.totalAmount != null ? ` (total ${formatMoney(entry.totalAmount)})` : "";

  return body ? `${body}${total}` : total.trim();
}

/** "Buffalo 54 at Rs. 54/L" — used when milk type configuration changes. */
export function describeMilkType(milkType: AuditMilkTypeRef | null | undefined): string {
  if (!milkType) return "";
  const name = formatText(milkType.name);
  if (!name) return "";
  return milkType.rate != null ? `${name} at ${formatMoney(milkType.rate)}/L` : name;
}

export function describeMilkTypeList(milkTypes: AuditMilkTypeRef[]): string {
  const described = milkTypes.map(describeMilkType).filter(Boolean);
  return described.length > 0 ? described.join(", ") : "None";
}

/** Human labels for the `field` column, kept in one place so they stay consistent. */
export const AUDIT_FIELD = {
  fullName: "Name",
  mobileNumber: "Mobile number",
  address: "Address",
  notes: "Notes",
  status: "Status",
  cardNumber: "Card number",
  depositBalance: "Deposit balance",
  depositChange: "Deposit",
  primaryMilkType: "Primary milk type",
  otherMilkTypes: "Other milk types",
  entry: "Entry",
  billNumber: "Bill number",
  billTotal: "Bill total",
  previousDue: "Previous dues carried forward",
  billPeriod: "Billing period",
  amountReceived: "Amount received",
  paymentMethod: "Payment method",
  depositApplied: "Deposit applied",
  receiptNumber: "Receipt number",
  reason: "Reason",
  outstanding: "Outstanding",
  carriedForwardTo: "Carried forward to",
} as const;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "March 2026" */
export function formatBillPeriod(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1] ?? month} ${year}`;
}

export function formatPaymentMethod(method: string): string {
  return method === "upi" ? "UPI" : "Cash";
}
