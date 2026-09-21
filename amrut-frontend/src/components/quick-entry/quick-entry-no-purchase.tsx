import { CircleCheck, Loader2 } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { PERMISSIONS } from "@/config/permissions";
import { usePermissions } from "@/hooks/use-permissions";
import {
  useSetNoPurchaseMutation,
  type DailyLedgerResponse,
} from "@/services/daily-ledger.service";
import type { Customer } from "@/types/customer";

type Props = {
  customer: Customer | null;
  ledger?: DailyLedgerResponse | null;
  selectedDate: string;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDay(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? date : DATE_FORMATTER.format(parsed);
}

// Lets the round be carried on past a customer who bought nothing. Without it that day
// stays blank, and a blank day is indistinguishable from one nobody has reached yet.
export default function QuickEntryNoPurchase({ customer, ledger, selectedDate }: Props) {
  const { can } = usePermissions();
  const mutation = useSetNoPurchaseMutation();

  if (!customer || !can(PERMISSIONS.LEDGER_ENTRY_CREATE)) return null;

  const entryCount = ledger?.entries.length ?? 0;
  const hasEntries = entryCount > 0;
  const isMarked = ledger?.noPurchase === true && !hasEntries;
  const isBusy = mutation.isPending;

  function handleChange(next: boolean) {
    if (!customer || isBusy) return;

    mutation.mutate({ customerId: customer.id, date: selectedDate, noPurchase: next });
  }

  return (
    <div
      className={`rounded-lg border px-3 py-3 sm:px-4 ${
        isMarked ? "border-emerald-200 bg-emerald-50" : "border-neutral-200 bg-white"
      }`}
    >
      <label
        className={`flex items-start gap-3 ${
          hasEntries || isBusy ? "cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        <Checkbox
          className="mt-0.5"
          checked={isMarked}
          disabled={hasEntries || isBusy}
          onCheckedChange={(value) => handleChange(Boolean(value))}
        />

        <div className="min-w-0">
          <p
            className={`flex items-center gap-2 text-sm font-medium ${
              isMarked ? "text-emerald-900" : "text-neutral-800"
            }`}
          >
            {customer.fullName} bought nothing on {formatDay(selectedDate)}

            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}

            {isMarked && !isBusy ? (
              <CircleCheck className="h-4 w-4 text-emerald-600" />
            ) : null}
          </p>

          <p
            className={`mt-0.5 text-xs ${
              isMarked ? "text-emerald-800" : "text-neutral-500"
            }`}
          >
            {hasEntries
              ? `This day already has ${entryCount} ${entryCount === 1 ? "entry" : "entries"}. Remove them first to mark it as no purchase.`
              : isMarked
                ? "Recorded, so the rest of the family can see this day is done."
                : "Tick this to close the day off and move on to the next card."}
          </p>
        </div>
      </label>
    </div>
  );
}
