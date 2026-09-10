import type { CreatePaymentRequest } from "@/types/bill";
import { getDeviceId } from "@/services/utils/apiConnector";

const KEY = "amrut:offline-payment-queue";
export type PaymentQueueState = "pending" | "conflict" | "dead-letter";
export type QueuedPayment = {
  id: string;
  payload: CreatePaymentRequest & { clientRequestId: string };
  createdAt: string;
  deviceId: string;
  attempts: number;
  nextRetryAt: string;
  state: PaymentQueueState;
  lastError?: string;
};

function read(): QueuedPayment[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as QueuedPayment[];
  } catch {
    return [];
  }
}
function write(items: QueuedPayment[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("offline-queue:changed"));
}
export const paymentQueue = {
  all: read,
  add(payload: CreatePaymentRequest) {
    const request = {
      ...payload,
      clientRequestId: payload.clientRequestId ?? crypto.randomUUID(),
    };
    const duplicate = read().find(
      (item) => item.payload.clientRequestId === request.clientRequestId,
    );
    if (duplicate) return duplicate;
    const item: QueuedPayment = {
      id: crypto.randomUUID(),
      payload: request,
      createdAt: new Date().toISOString(),
      deviceId: getDeviceId(),
      attempts: 0,
      nextRetryAt: new Date().toISOString(),
      state: "pending",
    };
    write([...read(), item]);
    return item;
  },
  remove(id: string) {
    write(read().filter((item) => item.id !== id));
  },
  update(id: string, patch: Partial<QueuedPayment>) {
    write(
      read().map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  },
  retry(id: string) {
    this.update(id, {
      attempts: 0,
      nextRetryAt: new Date().toISOString(),
      state: "pending",
      lastError: undefined,
    });
  },
};
