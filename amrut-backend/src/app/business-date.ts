export const BUSINESS_TIME_ZONE = "Asia/Kolkata";

/** The Asia/Kolkata calendar day an instant falls on, as yyyy-mm-dd. */
export function toBusinessDateString(instant: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE }).format(instant);
}

/**
 * The instant a business day begins. India keeps a fixed +05:30 offset with no daylight
 * saving, so the offset can be written directly rather than derived per date.
 */
export function startOfBusinessDay(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000+05:30`);
}
