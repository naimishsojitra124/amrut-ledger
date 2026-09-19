import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useCustomerStatementQuery,
  useRefundDepositMutation,
  useTopUpDepositMutation,
} from "@/services/customer.service";
import { formatCurrency } from "@/utils/format-currency";
import OpeningBalanceCard from "@/components/customers/opening-balance-card";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB");

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function CustomerAccountTab({
  customerId,
}: {
  customerId: string;
}) {
  const statement = useCustomerStatementQuery(customerId);
  const topUp = useTopUpDepositMutation();
  const refund = useRefundDepositMutation();

  const [amountText, setAmountText] = useState("");
  const [notes, setNotes] = useState("");

  const isPending = topUp.isPending || refund.isPending;

  const amount = Number(amountText);
  const isValidAmount = Number.isFinite(amount) && amount > 0;

  const rows = useMemo(
    () =>
      (statement.data?.items ?? []).map((item, index) => ({
        item,
        key: `${item.date}-${item.reference ?? ""}-${index}`,
        dateLabel: DATE_FORMATTER.format(new Date(item.date)),
        typeLabel: item.type.replaceAll("_", " "),
      })),
    [statement.data?.items],
  );

  const transact = (kind: "top-up" | "refund") => {
    if (!isValidAmount || isPending) {
      return;
    }

    const mutation = kind === "top-up" ? topUp : refund;

    mutation.mutate(
      {
        id: customerId,
        amount,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          setAmountText("");
          setNotes("");
        },
      },
    );
  };

  if (statement.isPending) {
    return (
      <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-neutral-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading account statement...
      </div>
    );
  }

  if (statement.isError) {
    return (
      <div className="flex min-h-40 items-center justify-center px-4 text-center text-sm text-red-600">
        {getErrorMessage(
          statement.error,
          "Failed to load customer account statement.",
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <OpeningBalanceCard customerId={customerId} />

      <div className="space-y-4 rounded-xl border bg-slate-50 p-3 sm:p-4">
        <div>
          <p className="text-sm text-slate-500">Available deposit</p>
          <p className="mt-0.5 text-xl font-semibold sm:text-2xl">
            {formatCurrency(statement.data?.depositBalance ?? 0)}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)_auto_auto]">
          <Input
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="Amount"
            disabled={isPending}
          />

          <Input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Note (optional)"
            maxLength={500}
            disabled={isPending}
          />

          <Button
            type="button"
            disabled={!isValidAmount || isPending}
            onClick={() => transact("top-up")}
          >
            {topUp.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Top up
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={!isValidAmount || isPending}
            onClick={() => transact("refund")}
          >
            {refund.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Refund
          </Button>
        </div>

        {!isValidAmount && amountText && (
          <p className="text-xs text-red-600">
            Enter an amount greater than ₹0.
          </p>
        )}

        {(topUp.isError || refund.isError) && (
          <p className="text-sm text-red-600">
            {getErrorMessage(
              topUp.error ?? refund.error,
              "Failed to update deposit balance.",
            )}
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border">
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-180 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Reference</th>
                  <th className="p-3 text-right">Debit</th>
                  <th className="p-3 text-right">Credit</th>
                  <th className="p-3 text-right">Running due</th>
                </tr>
              </thead>

              <tbody>
                {rows.map(({ item, key, dateLabel, typeLabel }) => (
                  <tr key={key} className="border-t">
                    <td className="whitespace-nowrap p-3">{dateLabel}</td>

                    <td className="p-3 capitalize">{typeLabel}</td>

                    <td className="max-w-56 truncate p-3">
                      {item.reference || "—"}
                    </td>

                    <td className="whitespace-nowrap p-3 text-right">
                      {item.debit ? formatCurrency(item.debit) : "—"}
                    </td>

                    <td className="whitespace-nowrap p-3 text-right">
                      {item.credit ? formatCurrency(item.credit) : "—"}
                    </td>

                    <td className="whitespace-nowrap p-3 text-right font-medium">
                      {formatCurrency(item.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-32 items-center justify-center px-4 text-center text-sm text-neutral-500">
            No account transactions available.
          </div>
        )}
      </div>
    </div>
  );
}
