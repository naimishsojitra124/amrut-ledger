import { useState } from "react";
import { History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLastLedgerEntryQuery } from "@/services/daily-ledger.service";
import { BUSINESS_TIME_ZONE, businessToday } from "@/config/business";

type Props = {
  selectedDate: string;
  onResume: (date: string, cardNumber: number) => void;
};


// The ledger date is a business day stored as UTC midnight.
const LEDGER_DATE_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

// When it was typed in is a real instant, so it reads in shop time.
const RECORDED_AT_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: BUSINESS_TIME_ZONE,
});

// Whole days between two yyyy-mm-dd business dates.
function daysBetween(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);

  if (Number.isNaN(start) || Number.isNaN(end)) return 0;

  return Math.round((end - start) / 86_400_000);
}

function describeRecordedAt(recordedAt: string) {
  const at = new Date(recordedAt);

  if (Number.isNaN(at.getTime())) return "";

  const minutes = Math.round((Date.now() - at.getTime()) / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 20) return `${Math.round(minutes / 60)} hr ago`;

  return RECORDED_AT_FORMATTER.format(at);
}

// Tells whoever opens Quick Entry where the last person stopped, so a
// half-finished day is picked up from the right card instead of guessed at.
export default function QuickEntryLastEntry({ selectedDate, onResume }: Props) {
  const { data, isPending, isError } = useLastLedgerEntryQuery();

  const [today] = useState(businessToday);

  if (isError) return null;

  if (isPending) {
    return <Skeleton className="h-16 w-full rounded-lg" />;
  }

  if (!data) {
    return (
      <div className="flex items-start gap-2 rounded-lg border bg-white px-3 py-3 text-sm text-neutral-600 sm:items-center sm:px-4">
        <History className="mt-0.5 h-4 w-4 shrink-0 text-[#266699] sm:mt-0" />
        <span>No entries recorded yet.</span>
      </div>
    );
  }

  const daysBehind = daysBetween(data.ledgerDate, today);
  const isBehind = daysBehind > 0;
  const alreadyThere = selectedDate === data.ledgerDate;

  return (
    <div
      className={`rounded-lg border px-3 py-3 sm:px-4 ${
        isBehind ? "border-amber-200 bg-amber-50" : "border-neutral-200 bg-white"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2 sm:items-center">
          <History
            className={`mt-0.5 h-4 w-4 shrink-0 sm:mt-0 ${
              isBehind ? "text-amber-700" : "text-[#266699]"
            }`}
          />

          <div className="min-w-0">
            <p
              className={`text-sm font-medium ${
                isBehind ? "text-amber-900" : "text-neutral-800"
              }`}
            >
              Last entry:{" "}
              <span className="font-semibold">
                {data.cardNumber === null
                  ? "No card"
                  : `Card ${data.cardNumber}`}
              </span>{" "}
              on{" "}
              <span className="font-semibold">
                {LEDGER_DATE_FORMATTER.format(
                  new Date(`${data.ledgerDate}T00:00:00.000Z`),
                )}
              </span>
            </p>

            <p
              className={`mt-0.5 text-xs ${
                isBehind ? "text-amber-800" : "text-neutral-500"
              }`}
            >
              {data.customerName}
              {data.noPurchase ? " · marked as no purchase" : ""}
              {data.recordedBy ? ` · by ${data.recordedBy.fullName}` : ""}
              {` · ${describeRecordedAt(data.recordedAt)}`}
              {isBehind
                ? ` · ${daysBehind} ${daysBehind === 1 ? "day" : "days"} of entries still pending`
                : ""}
            </p>
          </div>
        </div>

        {data.cardNumber !== null && !alreadyThere ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 bg-white"
            onClick={() => onResume(data.ledgerDate, data.cardNumber as number)}
          >
            Continue from here
          </Button>
        ) : null}
      </div>
    </div>
  );
}
