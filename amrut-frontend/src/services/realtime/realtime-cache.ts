import type { QueryClient } from "@tanstack/react-query";

import {
  dailyLedgerQueryKey,
  LAST_LEDGER_ENTRY_KEY,
  mapLedger,
  type DailyLedgerResponse,
  type LastLedgerEntryResponse,
} from "@/services/daily-ledger.service";
import { customerQueryKeys } from "@/services/customer.service";
import type { CustomerListItemResponse, CustomerResponse } from "@/types/customer";

import type { RealtimeChangeEvent } from "./realtime.types";

// What the server pushed was enough to bring every cached view up to date, so no
// refetch is owed. False means the caller should fall back to invalidating.
export type CacheOutcome = { settled: boolean };

const SETTLED: CacheOutcome = { settled: true };
const UNSETTLED: CacheOutcome = { settled: false };

type CustomerRow = CustomerListItemResponse & {
  primaryMilk: unknown;
  cardNumber: number | null;
  outstandingAmount: number;
  lastEntryAt: string | null;
};

type CustomerListCache = {
  items: CustomerRow[];
  pageInfo: unknown;
};

type DailyHistoryItem = {
  id: string;
  ledgerDate: string;
  entries: unknown[];
  noPurchase: boolean;
  createdAt: string;
  updatedAt: string;
};

type DailyHistoryCache = {
  items: DailyHistoryItem[];
  pageInfo: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The list hook reshapes each row on the way in, so a pushed record has to be put
// through the same shaping or the table reads undefined fields.
function toCustomerRow(customer: CustomerResponse): CustomerRow {
  return {
    ...(customer as unknown as CustomerListItemResponse),
    primaryMilk: customer.milkTypes?.find((item) => item.isDefault) ?? null,
    cardNumber: customer.currentCard?.cardNumber ?? null,
    outstandingAmount: customer.outstandingAmount ?? 0,
    lastEntryAt: customer.lastEntryAt ?? null,
  };
}

function isCustomerResponse(data: unknown): data is CustomerResponse {
  return isRecord(data) && typeof data.id === "string" && typeof data.fullName === "string";
}

function isDailyLedger(data: unknown): data is DailyLedgerResponse {
  return (
    isRecord(data) &&
    typeof data.id === "string" &&
    typeof data.ledgerDate === "string" &&
    Array.isArray(data.entries)
  );
}

// The no-purchase endpoint answers with a wrapper rather than the ledger itself, and
// a cleared day legitimately carries no ledger at all.
function readLedgerPayload(
  data: unknown,
): { ledger: DailyLedgerResponse | null; customerId: string; date: string } | null {
  if (isRecord(data) && "ledger" in data && typeof data.ledgerDate === "string") {
    const inner = data.ledger;

    return {
      ledger: isDailyLedger(inner) ? inner : null,
      customerId: typeof data.customerId === "string" ? data.customerId : "",
      date: data.ledgerDate.slice(0, 10),
    };
  }

  if (isDailyLedger(data)) {
    return {
      ledger: data,
      customerId: typeof data.customerId === "string" ? data.customerId : "",
      date: data.ledgerDate.slice(0, 10),
    };
  }

  return null;
}

function applyCustomer(queryClient: QueryClient, event: RealtimeChangeEvent): CacheOutcome {
  const customer = event.data;
  if (!isCustomerResponse(customer)) return UNSETTLED;

  queryClient.setQueryData(customerQueryKeys.detail(customer.id), customer);

  // A new or removed customer changes which page each row falls on, and a changed
  // card number or status changes the order, so those still need a real refetch.
  if (event.action !== "updated") return UNSETTLED;

  // Quick Entry holds the customer under the card it was looked up by, so that copy
  // would otherwise keep showing the old name or rate.
  for (const [key, cached] of queryClient.getQueriesData<CustomerResponse>({
    queryKey: ["customers", "card-lookup"],
  })) {
    if (cached?.id === customer.id) queryClient.setQueryData(key, customer);
  }

  const row = toCustomerRow(customer);
  let orderingChanged = false;

  for (const [key, cached] of queryClient.getQueriesData<CustomerListCache>({
    queryKey: ["customers", "list"],
  })) {
    if (!cached?.items) continue;

    const index = cached.items.findIndex((item) => item.id === customer.id);
    if (index === -1) continue;

    const previous = cached.items[index];
    if (previous && (previous.cardNumber !== row.cardNumber || previous.status !== row.status)) {
      orderingChanged = true;
    }

    const items = [...cached.items];
    items[index] = row;

    queryClient.setQueryData(key, { ...cached, items });
  }

  // A page that holds no copy of this customer has nothing to correct, so only a
  // genuine change of order or membership is worth a refetch.
  return orderingChanged ? UNSETTLED : SETTLED;
}

function applyDailyLedger(queryClient: QueryClient, event: RealtimeChangeEvent): CacheOutcome {
  const payload = readLedgerPayload(event.data);
  if (!payload || !payload.customerId) return UNSETTLED;

  const { ledger, customerId, date } = payload;
  const key = dailyLedgerQueryKey(customerId, date);

  if (ledger) {
    queryClient.setQueryData(key, mapLedger(ledger));
  } else {
    queryClient.removeQueries({ queryKey: key });
  }

  const monthPatched = patchDailyHistory(queryClient, customerId, date, ledger);
  const listPatched = patchCustomerLastEntry(queryClient, customerId, date, ledger);
  const markerPatched = patchLastEntryMarker(queryClient, event, ledger);

  return monthPatched && listPatched && markerPatched ? SETTLED : UNSETTLED;
}

function patchDailyHistory(
  queryClient: QueryClient,
  customerId: string,
  date: string,
  ledger: DailyLedgerResponse | null,
): boolean {
  const caches = queryClient.getQueriesData<DailyHistoryCache>({
    queryKey: ["customers", "daily-history", customerId],
  });

  if (caches.length === 0) return true;

  for (const [key, cached] of caches) {
    if (!cached?.items) continue;

    const index = cached.items.findIndex((item) => item.ledgerDate.slice(0, 10) === date);

    if (!ledger) {
      if (index === -1) continue;

      const items = cached.items.filter((_, position) => position !== index);
      queryClient.setQueryData(key, { ...cached, items });
      continue;
    }

    const next: DailyHistoryItem = {
      id: ledger.id,
      ledgerDate: ledger.ledgerDate,
      entries: ledger.entries,
      noPurchase: ledger.noPurchase,
      createdAt: ledger.createdAt,
      updatedAt: ledger.updatedAt,
    };

    const items = [...cached.items];

    if (index === -1) {
      items.push(next);
      items.sort((a, b) => a.ledgerDate.localeCompare(b.ledgerDate));
    } else {
      items[index] = next;
    }

    queryClient.setQueryData(key, { ...cached, items });
  }

  return true;
}

// "Last entry" is the newest ledger date the customer has, counted by the row and not
// by what is in it, so a confirmed empty day moves it too. Removing a row can move it
// backwards, which cannot be worked out from here.
function patchCustomerLastEntry(
  queryClient: QueryClient,
  customerId: string,
  date: string,
  ledger: DailyLedgerResponse | null,
): boolean {
  if (!ledger) return false;

  const lastEntryAt = `${date}T00:00:00.000Z`;

  for (const [key, cached] of queryClient.getQueriesData<CustomerListCache>({
    queryKey: ["customers", "list"],
  })) {
    if (!cached?.items) continue;

    const index = cached.items.findIndex((item) => item.id === customerId);
    if (index === -1) continue;

    const row = cached.items[index];
    if (!row) continue;

    if ((row.lastEntryAt ?? "").slice(0, 10) >= date) continue;

    const items = [...cached.items];
    items[index] = { ...row, lastEntryAt };

    queryClient.setQueryData(key, { ...cached, items });
  }

  // The drawer shows the same field, so it would otherwise sit one day behind.
  queryClient.setQueryData<CustomerResponse>(
    customerQueryKeys.detail(customerId),
    (current) =>
      current && (current.lastEntryAt ?? "").slice(0, 10) < date
        ? { ...current, lastEntryAt }
        : current,
  );

  return true;
}

// This event is by definition the most recent thing recorded, so the resume marker can
// be written rather than fetched. A deletion can move it backwards, which cannot.
function patchLastEntryMarker(
  queryClient: QueryClient,
  event: RealtimeChangeEvent,
  ledger: DailyLedgerResponse | null,
): boolean {
  if (event.action === "deleted" || !ledger) return false;

  const cached = queryClient.getQueryData<LastLedgerEntryResponse | null>(LAST_LEDGER_ENTRY_KEY);
  if (cached === undefined) return true;

  const marker: LastLedgerEntryResponse = {
    ledgerDate: ledger.ledgerDate.slice(0, 10),
    cardNumber: ledger.cardAssignment?.cardNumber ?? null,
    customerId: ledger.customerId,
    customerName: ledger.customer?.fullName ?? "",
    recordedAt: event.at,
    recordedBy: event.actor
      ? { id: event.actor.id, fullName: event.actor.fullName ?? "", status: "active" }
      : null,
    noPurchase: ledger.noPurchase && ledger.entries.length === 0,
  };

  queryClient.setQueryData(LAST_LEDGER_ENTRY_KEY, marker);

  return true;
}

// Only the resources whose pushed record is the whole truth are patched here. Money
// totals are recomputed by the server across bills, payments and deposits, so those
// deliberately fall through to a refetch rather than being guessed at locally.
export function applyRealtimeToCache(
  queryClient: QueryClient,
  event: RealtimeChangeEvent,
): CacheOutcome {
  if (event.phase !== "success" || event.data === undefined) return UNSETTLED;

  switch (event.resource) {
    case "customer":
      return applyCustomer(queryClient, event);
    case "daily-ledger":
      return applyDailyLedger(queryClient, event);
    default:
      return UNSETTLED;
  }
}
