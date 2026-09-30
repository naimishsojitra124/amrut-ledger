import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import QuickEntryForm from "@/components/quick-entry/quick-entry-form";
import { useCustomerQuery } from "@/services/customer.service";
import {
  type AddDailyLedgerEntryRequest,
  type DailyLedgerEntryResponse,
  useAddDailyLedgerEntryMutation,
  useCustomerDailyLedgerQuery,
  useDeleteDailyLedgerEntryMutation,
} from "@/services/daily-ledger.service";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/permissions";
import { formatCurrency } from "@/utils/format-currency";
import { entryAmount } from "@/lib/ledger-money";

type Props = {
  customerId: string;
  /** The business day being corrected, as yyyy-mm-dd. */
  date: string;
  onClose: () => void;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function describeEntry(entry: DailyLedgerEntryResponse): string {
  const milk = entry.milkEntries.map(
    (item) => `${item.litres.toFixed(2)} Ltr ${item.milkTypeName ?? "Milk"}`,
  );

  const products = entry.productEntries.map(
    (item) => `${item.itemName} × ${item.quantity}`,
  );

  return [...milk, ...products].join(", ") || "Empty entry";
}

/**
 * Correcting a day without leaving the ledger.
 *
 * Reconciling a month against the customer's card turns up days that were missed, and
 * the way round that was to close this screen, go back to Quick Entry, set the date and
 * start again — for each missing day. The same entry form is mounted here instead, so a
 * correction happens on the row where the gap was spotted.
 */
export default function LedgerDayEditor({ customerId, date, onClose }: Props) {
  const { can } = usePermissions();

  const customer = useCustomerQuery(customerId).data ?? null;
  const ledgerQuery = useCustomerDailyLedgerQuery(customerId, date);

  const addEntry = useAddDailyLedgerEntryMutation();
  const deleteEntry = useDeleteDailyLedgerEntryMutation();

  const [removingId, setRemovingId] = useState<string | null>(null);

  const entries = ledgerQuery.data?.entries ?? [];

  const canDelete = can(PERMISSIONS.LEDGER_ENTRY_DELETE);

  async function handleSaveEntry(payload: AddDailyLedgerEntryRequest) {
    await addEntry.mutateAsync({ customerId, date, payload });

    // Reconciling against the card means working down the month a day at a time, so
    // the row collapses once its entry is saved and the next gap is back in view.
    // Only on success: a failed save keeps the form and its draft on screen.
    onClose();
  }

  return (
    <div className="space-y-3 rounded-lg border bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#266699]">
            Editing {DATE_FORMATTER.format(new Date(`${date}T00:00:00Z`))}
          </p>

          <p className="text-xs text-neutral-500">
            Anything saved here updates this month&apos;s bill straight away.
          </p>
        </div>

        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>

      {entries.length ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-neutral-500">
            Already recorded on this day
          </p>

          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-md border bg-neutral-50 px-3 py-2"
            >
              <span className="min-w-0 text-sm text-neutral-700">
                {describeEntry(entry)}
              </span>

              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-semibold text-neutral-800">
                  {formatCurrency(entryAmount(entry))}
                </span>

                {canDelete ? (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Remove this entry"
                    disabled={deleteEntry.isPending && removingId === entry.id}
                    onClick={() => {
                      setRemovingId(entry.id);

                      deleteEntry.mutate(
                        { customerId, date, entryId: entry.id },
                        { onSettled: () => setRemovingId(null) },
                      );
                    }}
                  >
                    {deleteEntry.isPending && removingId === entry.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-red-500" />
                    )}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-neutral-500">
          Nothing recorded on this day yet.
        </p>
      )}

      <QuickEntryForm
        customer={customer}
        ledger={ledgerQuery.data ?? null}
        isBusy={addEntry.isPending}
        onSaveEntry={handleSaveEntry}
      />
    </div>
  );
}
