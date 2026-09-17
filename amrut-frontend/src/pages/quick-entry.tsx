import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { Keyboard, WifiOff } from "lucide-react";
import { toast } from "sonner";

import PageHeader from "@/components/common/page-header";
import QuickEntryCustomerCard from "@/components/quick-entry/quick-entry-customer-card";
import QuickEntryForm from "@/components/quick-entry/quick-entry-form";
import QuickEntryLedger from "@/components/quick-entry/quick-entry-ledger";

import { useCustomerByCardNumberQuery } from "@/services/customer.service";
import type { Customer } from "@/types/customer";

import {
  useAddDailyLedgerEntryMutation,
  useCustomerDailyLedgerQuery,
  type AddDailyLedgerEntryRequest,
} from "@/services/daily-ledger.service";

import { enqueueLedgerEntry } from "@/services/offline-ledger-queue.service";
import { useOfflineLedgerSync } from "@/hooks/use-offline-ledger-sync";
import { offlineQuickEntryCache } from "@/services/offline-quick-entry-cache.service";

const BUSINESS_TIME_ZONE = "Asia/Kolkata";

const getBusinessDateString = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
  }).format(new Date());

const subscribeOnlineStatus = (callback: () => void) => {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);

  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
};

const getOnlineStatus = () => navigator.onLine;

const getServerOnlineStatus = () => true;

export default function QuickEntry() {
  const [cardNumber, setCardNumber] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(getBusinessDateString);

  const isOnline = useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineStatus,
    getServerOnlineStatus,
  );

  const normalizedSearch = searchQuery.trim();
  const customerLookupQuery = useCustomerByCardNumberQuery(
    normalizedSearch,
    isOnline,
  );

  const addLedgerEntryMutation = useAddDailyLedgerEntryMutation();
  const { pendingCount } = useOfflineLedgerSync();

  const cachedCustomers = useMemo(
    () => offlineQuickEntryCache.get().customers as Customer[],
    [],
  );

  const selectedCustomer = isOnline
    ? (customerLookupQuery.data ?? null)
    : (cachedCustomers.find(
        (customer) =>
          String(customer.currentCard?.cardNumber ?? "") === normalizedSearch,
      ) ?? null);

  useEffect(() => {
    const customer = customerLookupQuery.data;

    if (!customer) {
      return;
    }

    const cached = offlineQuickEntryCache.get().customers as Customer[];
    const nextCustomers = [
      ...cached.filter((item) => item.id !== customer.id),
      customer,
    ];

    offlineQuickEntryCache.saveCustomers(nextCustomers);
  }, [customerLookupQuery.data]);

  useEffect(() => {
    if (customerLookupQuery.isError && normalizedSearch) {
      toast.error(
        customerLookupQuery.error instanceof Error
          ? customerLookupQuery.error.message
          : "Failed to search customer.",
      );
    }
  }, [
    customerLookupQuery.error,
    customerLookupQuery.isError,
    normalizedSearch,
  ]);

  const ledgerQuery = useCustomerDailyLedgerQuery(
    selectedCustomer?.id ?? null,
    selectedDate,
  );

  function handleSearchCustomer() {
    const normalizedCardNumber = cardNumber.trim();

    if (!/^\d+$/.test(normalizedCardNumber)) {
      toast.error("Enter a valid card number.");
      return;
    }

    if (normalizedCardNumber === searchQuery) {
      void customerLookupQuery.refetch();
      return;
    }

    setSearchQuery(normalizedCardNumber);
  }

  async function handleSaveEntry(payload: AddDailyLedgerEntryRequest) {
    if (!selectedCustomer) {
      throw new Error("Search a customer first.");
    }

    const payloadWithId = {
      ...payload,
      clientRequestId: crypto.randomUUID(),
    };

    const queuedEntry = {
      customerId: selectedCustomer.id,
      date: selectedDate,
      ...payloadWithId,
    };

    if (!isOnline) {
      enqueueLedgerEntry(queuedEntry);
      toast.success(
        "Saved offline. It will sync automatically when connected.",
      );
      return;
    }

    try {
      await addLedgerEntryMutation.mutateAsync({
        customerId: selectedCustomer.id,
        date: selectedDate,
        payload: payloadWithId,
      });

      toast.success("Ledger entry saved.");
    } catch (error) {
      if (!navigator.onLine) {
        enqueueLedgerEntry(queuedEntry);
        toast.success(
          "Saved offline. It will sync automatically when connected.",
        );
        return;
      }

      toast.error(
        error instanceof Error ? error.message : "Failed to save entry.",
      );

      throw error;
    }
  }

  const showOfflineBanner = pendingCount > 0 || !isOnline;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 overflow-y-auto px-3 py-3 sm:gap-5 sm:px-5">
      <PageHeader
        title="Quick Entry"
        description="Add today's entries quickly and efficiently."
        icon={<Keyboard className="h-5 w-5 text-[#266699] sm:h-6 sm:w-6" />}
      />

      {showOfflineBanner && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 sm:items-center sm:px-4">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" />

          <span>
            {pendingCount > 0
              ? `${pendingCount} ${
                  pendingCount === 1 ? "entry" : "entries"
                } waiting to sync.`
              : "Offline mode: using saved customer and item lookups."}
          </span>
        </div>
      )}

      <QuickEntryCustomerCard
        cardNumber={cardNumber}
        onCardNumberChange={setCardNumber}
        onSearch={handleSearchCustomer}
        isSearching={customerLookupQuery.isFetching}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        customer={selectedCustomer}
        ledger={ledgerQuery.data ?? null}
      />

      <QuickEntryForm
        key={`${selectedCustomer?.id ?? "none"}-${selectedDate}`}
        customer={selectedCustomer}
        ledger={ledgerQuery.data ?? null}
        isBusy={addLedgerEntryMutation.isPending}
        isOnline={isOnline}
        onSaveEntry={handleSaveEntry}
      />

      <QuickEntryLedger
        customer={selectedCustomer}
        ledger={ledgerQuery.data ?? null}
        selectedDate={selectedDate}
      />
    </div>
  );
}
