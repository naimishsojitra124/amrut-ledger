import { isRetryable } from "@/services/utils/query-config";
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addDailyLedgerEntry } from "@/services/daily-ledger.service";
import { getApiErrorMessage } from "@/services/utils/apiConnector";
import axios from "axios";

// An expired session must never discard a queued entry: that is the user's unsaved work.
import {
  getQueuedLedgerEntries,
  removeQueuedLedgerEntry,
  updateQueuedLedgerEntry,
} from "@/services/offline-ledger-queue.service";

export function useOfflineLedgerSync() {
  const queryClient = useQueryClient();
  const [pendingCount, setPendingCount] = useState(
    () => getQueuedLedgerEntries().length,
  );

  const sync = useCallback(async () => {
    if (!navigator.onLine) return;

    for (const entry of getQueuedLedgerEntries()) {
      if (entry.state !== "pending" || new Date(entry.nextRetryAt) > new Date())
        continue;

      try {
        await addDailyLedgerEntry(entry.customerId, entry.date, entry);
        removeQueuedLedgerEntry(entry.id);
        await queryClient.invalidateQueries({
          queryKey: ["daily-ledgers", entry.customerId, entry.date],
        });
        await queryClient.invalidateQueries({ queryKey: ["customers"] });
      } catch (error) {
        const attempts = entry.attempts + 1;
        const status = axios.isAxiosError(error)
          ? error.response?.status
          : undefined;
        const lastError = getApiErrorMessage(error, "Sync failed");

        const retryable = isRetryable(status);

        updateQueuedLedgerEntry(entry.id, {
          attempts,
          lastError,
          state:
            status === 409
              ? "conflict"
              : !retryable || attempts >= 8
                ? "dead-letter"
                : "pending",
          nextRetryAt: new Date(
            Date.now() + Math.min(300_000, 1_000 * 2 ** attempts),
          ).toISOString(),
        });
      }
    }
    setPendingCount(getQueuedLedgerEntries().length);
  }, [queryClient]);

  useEffect(() => {
    void sync();
    window.addEventListener("online", sync);
    const timer = window.setInterval(() => void sync(), 30_000);
    return () => {
      window.removeEventListener("online", sync);
      window.clearInterval(timer);
    };
  }, [sync]);
  return { pendingCount, sync };
}
