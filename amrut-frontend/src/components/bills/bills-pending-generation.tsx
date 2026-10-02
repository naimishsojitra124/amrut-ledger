import { useMemo, useState } from "react";

import { ChevronDown, ChevronUp, CircleAlert, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBusinessMonth, previousBusinessMonth } from "@/config/business";
import { useBillsPendingGenerationQuery } from "@/services/bill.service";
import { useModalStore } from "@/store/modal.store";
import { formatCurrency } from "@/utils/format-currency";

export default function BillsPendingGeneration() {
  const period = useMemo(() => previousBusinessMonth(), []);
  const periodLabel = useMemo(() => formatBusinessMonth(period), [period]);
  const [expanded, setExpanded] = useState(false);
  const openFullLedger = useModalStore((state) => state.openFullLedger);

  // The last day of the month being billed, so the ledger opens on that month.
  const lastDayOfPeriod = useMemo(
    () => new Date(Date.UTC(period.year, period.month, 0)).toISOString().slice(0, 10),
    [period],
  );

  const { data, isPending, isError } = useBillsPendingGenerationQuery(
    period.month,
    period.year,
  );

  if (isPending) {
    return <Skeleton className="h-16 w-full rounded-xl" />;
  }

  // A failure here must not imply "nothing pending", which would be the worst wrong answer.
  if (isError || !data) {
    return null;
  }

  if (data.totalPending === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 sm:px-4">
        <CircleCheck className="h-5 w-5 shrink-0 text-emerald-600" />

        <p className="min-w-0 text-sm font-medium text-emerald-800">
          Every card is billed for {periodLabel}.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50">
      <div className="flex items-start gap-3 px-3 py-3 sm:px-4">
        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900">
            {data.totalPending}{" "}
            {data.totalPending === 1 ? "card still needs" : "cards still need"} a
            bill for {periodLabel}
          </p>

          <p className="mt-0.5 text-sm text-amber-800">
            {formatCurrency(data.estimatedTotal)} to bill
            {data.previousDueTotal > 0
              ? `, incl. ${formatCurrency(data.previousDueTotal)} carried from earlier bills`
              : ""}
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 border-amber-300 bg-white/70 text-amber-900 hover:bg-white"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          // The label beside the chevron is hidden on a phone, leaving the button unnamed.
          aria-label={expanded ? "Hide the pending cards" : "Show the pending cards"}
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}

          <span className="ml-1 hidden sm:inline">
            {expanded ? "Hide" : "Show"}
          </span>
        </Button>
      </div>

      {expanded ? (
        <ul className="max-h-96 overflow-y-auto overscroll-contain border-t border-amber-200">
          {data.items.map((item) => (
            <li
              key={item.customerId}
              className="border-b border-amber-100 last:border-b-0"
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-amber-100/60 sm:px-4"
                onClick={() =>
                  openFullLedger({
                    customerId: item.customerId,
                    selectedDate: lastDayOfPeriod,
                    outstandingAmount: item.previousDue,
                  })
                }
              >
                <span className="w-10 shrink-0 text-sm font-semibold text-amber-900">
                  {item.cardNumber ?? "—"}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-neutral-900">
                    {item.customerName}
                  </span>

                  {/* The row total is what the bill will say, which for a customer with
                      an older balance is well above the month itself — spelling the two
                      apart stops that reading as a wrong figure. */}
                  <span className="block text-xs text-neutral-600">
                    {item.entryDays > 0
                      ? `${item.entryDays} ${item.entryDays === 1 ? "day" : "days"} recorded`
                      : "Nothing bought"}
                    {item.previousDue > 0
                      ? ` · ${formatCurrency(item.currentCharges)} this month + ${formatCurrency(item.previousDue)} earlier`
                      : ""}
                  </span>
                </span>

                <span className="shrink-0 text-sm font-semibold whitespace-nowrap text-neutral-900">
                  {formatCurrency(item.estimatedTotal)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
