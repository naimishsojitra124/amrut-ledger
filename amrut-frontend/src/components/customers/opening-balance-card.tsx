import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useOpeningBalanceQuery,
  useRemoveOpeningBalanceMutation,
  useSetOpeningBalanceMutation,
} from "@/services/customer.service";
import { formatCurrency } from "@/utils/format-currency";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/permissions";

/**
 * The balance a customer was already carrying when the shop moved off paper.
 *
 * It is stored as a bill, so once recorded it behaves like any other
 * receivable: it can be paid, it is carried into the first generated bill, and
 * it counts towards the customer's outstanding total.
 */

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatPeriod(month: number, year: number) {
  return `${MONTH_NAMES[month - 1] ?? month} ${year}`;
}

/** The month that just ended — where a brought-forward balance belongs. */
function previousPeriod() {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed, so this is already last month
  return month === 0
    ? { month: 12, year: now.getFullYear() - 1 }
    : { month, year: now.getFullYear() };
}

const YEAR_OPTIONS = (() => {
  const current = new Date().getFullYear();
  return [current, current - 1, current - 2];
})();

export default function OpeningBalanceCard({
  customerId,
}: {
  customerId: string;
}) {
  const opening = useOpeningBalanceQuery(customerId);
  const setOpening = useSetOpeningBalanceMutation();
  const removeOpening = useRemoveOpeningBalanceMutation();

  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.CUSTOMER_OPENING_BALANCE_MANAGE);

  const defaults = previousPeriod();

  const [amountText, setAmountText] = useState("");
  const [month, setMonth] = useState(defaults.month);
  const [year, setYear] = useState(defaults.year);
  const [notes, setNotes] = useState("");

  const amount = Math.round(Number(amountText));
  const isValidAmount = Number.isFinite(amount) && amount > 0;
  const isBusy = setOpening.isPending || removeOpening.isPending;

  if (opening.isPending) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-white p-3 text-sm text-neutral-500 sm:p-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading opening balance...
      </div>
    );
  }

  const record = opening.data;

  if (record) {
    const isSettled = record.outstandingAmount <= 0;
    const isCarriedForward = Boolean(record.carriedForwardToBillId);
    const isLocked = isCarriedForward || record.totalPaid > 0;

    return (
      <div className="space-y-3 rounded-xl border bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">
              Opening outstanding · {formatPeriod(record.month, record.year)}
            </p>

            <p className="mt-0.5 text-xl font-semibold sm:text-2xl">
              {formatCurrency(record.amount)}
            </p>

            <p className="mt-1 text-xs text-neutral-500">
              {record.billNumber}
              {record.totalPaid > 0 &&
                ` · ${formatCurrency(record.totalPaid)} received`}
              {isSettled && !isCarriedForward && " · settled"}
              {isCarriedForward && " · carried into a later bill"}
            </p>
          </div>

          {!isLocked && canManage && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={() => removeOpening.mutate(customerId)}
            >
              {removeOpening.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Remove
            </Button>
          )}
        </div>

        {record.notes && (
          <p className="text-sm text-neutral-600">{record.notes}</p>
        )}

        {isLocked && (
          <p className="text-xs text-neutral-500">
            {isCarriedForward
              ? "This balance has been carried into a later bill and can no longer be changed here."
              : "Payments have been recorded against this balance. Reverse them before removing it."}
          </p>
        )}
      </div>
    );
  }

  // Nothing recorded and nothing this user can do about it — say nothing.
  if (!canManage) return null;

  return (
    <div className="space-y-3 rounded-xl border border-dashed bg-white p-3 sm:p-4">
      <div>
        <p className="text-sm font-medium">Opening outstanding</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          Record what this customer already owed from your paper records. It
          will be carried into their first bill generated here.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[140px_130px_110px_minmax(0,1fr)_auto]">
        <Input
          value={amountText}
          onChange={(event) => setAmountText(event.target.value)}
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          placeholder="Amount"
          disabled={isBusy}
          aria-label="Opening outstanding amount"
        />

        <select
          value={month}
          onChange={(event) => setMonth(Number(event.target.value))}
          disabled={isBusy}
          aria-label="Month"
          className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#266699]"
        >
          {MONTH_NAMES.map((name, index) => (
            <option key={name} value={index + 1}>
              {name}
            </option>
          ))}
        </select>

        <select
          value={year}
          onChange={(event) => setYear(Number(event.target.value))}
          disabled={isBusy}
          aria-label="Year"
          className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#266699]"
        >
          {YEAR_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <Input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Note (optional)"
          maxLength={500}
          disabled={isBusy}
        />

        <Button
          type="button"
          disabled={!isValidAmount || isBusy}
          onClick={() =>
            setOpening.mutate(
              {
                customerId,
                payload: {
                  amount,
                  month,
                  year,
                  ...(notes.trim() ? { notes: notes.trim() } : {}),
                },
              },
              {
                onSuccess: () => {
                  setAmountText("");
                  setNotes("");
                },
              },
            )
          }
        >
          {setOpening.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Record
        </Button>
      </div>
    </div>
  );
}
