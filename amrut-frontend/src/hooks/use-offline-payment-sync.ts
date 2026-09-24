import { isRetryable } from "@/services/utils/query-config";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { recordPayment } from "@/services/bill.service";
import { getApiErrorMessage } from "@/services/utils/apiConnector";
import { paymentQueue } from "@/services/offline-payment-queue.service";

const MAX_ATTEMPTS = 8;

// A queued payment is money already taken, so only a real rejection may drop it.
const refresh = (client: ReturnType<typeof useQueryClient>) =>
  client
    .invalidateQueries({ queryKey: ["bills"] })
    .then(() => client.invalidateQueries({ queryKey: ["payments"] }));

export function useOfflinePaymentSync() {
  const client = useQueryClient();
  const [items, setItems] = useState(paymentQueue.all);
  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    for (const item of paymentQueue.all()) {
      if (item.state !== "pending" || new Date(item.nextRetryAt) > new Date())
        continue;
      try {
        await recordPayment(item.payload);
        paymentQueue.remove(item.id);
        await refresh(client);
      } catch (error) {
        const status = axios.isAxiosError(error)
          ? error.response?.status
          : undefined;
        const message = getApiErrorMessage(error, "Sync failed");
        if (status === 409)
          paymentQueue.update(item.id, {
            state: "conflict",
            lastError: message,
            attempts: item.attempts + 1,
          });
        else {
          const attempts = item.attempts + 1;
          paymentQueue.update(item.id, {
            attempts,
            state:
              attempts >= MAX_ATTEMPTS || !isRetryable(status)
                ? "dead-letter"
                : "pending",
            lastError: message,
            nextRetryAt: new Date(
              Date.now() + Math.min(300_000, 1_000 * 2 ** attempts),
            ).toISOString(),
          });
        }
      }
    }
    setItems(paymentQueue.all());
  }, [client]);
  useEffect(() => {
    void sync();
    const changed = () => setItems(paymentQueue.all());
    window.addEventListener("online", sync);
    window.addEventListener("offline-queue:changed", changed);
    const timer = window.setInterval(() => void sync(), 30_000);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline-queue:changed", changed);
      window.clearInterval(timer);
    };
  }, [sync]);
  return {
    items,
    pendingCount: items.filter((item) => item.state === "pending").length,
    reviewItems: items.filter((item) => item.state !== "pending"),
    sync,
    retry: paymentQueue.retry,
  };
}
