import type { AddDailyLedgerEntryRequest } from "@/services/daily-ledger.service";

const QUEUE_KEY = "amrut:offline-ledger-queue";

export type QueuedLedgerEntry = AddDailyLedgerEntryRequest & {
  id: string;
  customerId: string;
  date: string;
  createdAt: string;
  attempts: number;
  nextRetryAt: string;
  state: "pending" | "conflict" | "dead-letter";
  lastError?: string;
};

function readQueue(): QueuedLedgerEntry[] {
  try {
    return JSON.parse(
      localStorage.getItem(QUEUE_KEY) ?? "[]",
    ) as QueuedLedgerEntry[];
  } catch {
    return [];
  }
}
function writeQueue(queue: QueuedLedgerEntry[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}
export function getQueuedLedgerEntries() {
  return readQueue();
}
export function enqueueLedgerEntry(
  entry: Omit<
    QueuedLedgerEntry,
    "id" | "createdAt" | "attempts" | "nextRetryAt" | "state" | "lastError"
  >,
) {
  const queued = {
    ...entry,
    clientRequestId: entry.clientRequestId ?? crypto.randomUUID(),
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    attempts: 0,
    nextRetryAt: new Date().toISOString(),
    state: "pending" as const,
  };
  writeQueue([...readQueue(), queued]);
  return queued;
}
export function removeQueuedLedgerEntry(id: string) {
  writeQueue(readQueue().filter((entry) => entry.id !== id));
}
export function updateQueuedLedgerEntry(
  id: string,
  patch: Partial<QueuedLedgerEntry>,
) {
  writeQueue(
    readQueue().map((entry) =>
      entry.id === id ? { ...entry, ...patch } : entry,
    ),
  );
}
