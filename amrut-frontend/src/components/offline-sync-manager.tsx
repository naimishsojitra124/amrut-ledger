import { useOfflineLedgerSync } from "@/hooks/use-offline-ledger-sync";
import { useOfflinePaymentSync } from "@/hooks/use-offline-payment-sync";

export function OfflineSyncManager() {
  useOfflineLedgerSync();
  useOfflinePaymentSync();
  return null;
}
