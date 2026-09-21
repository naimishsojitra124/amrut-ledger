import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  ReceiptText,
} from "lucide-react";
import { toast } from "sonner";

import { QueryErrorState } from "@/components/common/query-error-state";
import { DataTableSkeleton } from "@/components/common/data-table-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCustomerDailyHistoryQuery } from "@/services/customer.service";
import { useGenerateBillMutation } from "@/services/bill.service";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/permissions";
import type { CustomerDailyHistoryItemResponse } from "@/types/customer";
import { formatCurrency } from "@/utils/format-currency";

type Props = {
  customerId: string;
  outstandingAmount?: number | null;
  initialDate?: string | null;
  // Offered where walking to the customer's Bills tab would be the long way
  // round, such as the ledger popup in Quick Entry.
  showGenerateBill?: boolean;
};

type MilkSummaryItem = {
  milkTypeId: string;
  milkTypeName: string;
  litres: number;
  rate: number;
  amount: number;
};

type ProductSummaryItem = {
  itemName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
});

const DATE_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  timeZone: "UTC",
});

const BUSINESS_TIME_ZONE = "Asia/Kolkata";

// A ledger date as the app stores it: the yyyy-mm-dd business day.
function toDateKey(value: string) {
  return value.slice(0, 10);
}

function businessToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
  }).format(new Date());
}

type DayRow = {
  dateKey: string;
  date: Date;
  item: CustomerDailyHistoryItemResponse | null;
};

const CURRENT_DATE = new Date();
const INITIAL_MONTH = CURRENT_DATE.getMonth() + 1;
const INITIAL_YEAR = CURRENT_DATE.getFullYear();

function buildMilkSummary(
  items: CustomerDailyHistoryItemResponse[],
): MilkSummaryItem[] {
  const summary = new Map<string, MilkSummaryItem>();

  for (const item of items) {
    for (const entry of item.entries) {
      for (const milk of entry.milkEntries ?? []) {
        const key = `${milk.milkTypeId}:${milk.rate}`;
        const existing = summary.get(key);

        if (existing) {
          existing.litres += milk.litres;
          existing.amount += milk.amount ?? 0;
          continue;
        }

        summary.set(key, {
          milkTypeId: milk.milkTypeId,
          milkTypeName: milk.milkTypeName ?? "Milk",
          litres: milk.litres,
          rate: milk.rate ?? 0,
          amount: milk.amount ?? 0,
        });
      }
    }
  }

  return Array.from(summary.values());
}

function buildProductSummary(
  items: CustomerDailyHistoryItemResponse[],
): ProductSummaryItem[] {
  const summary = new Map<string, ProductSummaryItem>();

  for (const item of items) {
    for (const entry of item.entries) {
      for (const product of entry.productEntries ?? []) {
        const key = `${product.itemName}:${product.unitPrice}`;
        const existing = summary.get(key);

        if (existing) {
          existing.quantity += product.quantity;
          existing.amount += product.amount ?? 0;
          continue;
        }

        summary.set(key, {
          itemName: product.itemName,
          quantity: product.quantity,
          unitPrice: product.unitPrice,
          amount: product.amount ?? 0,
        });
      }
    }
  }

  return Array.from(summary.values());
}

function getDailyTotal(item: CustomerDailyHistoryItemResponse) {
  return item.entries.reduce(
    (total, entry) =>
      total +
      (entry.milkEntries ?? []).reduce(
        (sum, milk) => sum + (milk.amount ?? 0),
        0,
      ) +
      (entry.productEntries ?? []).reduce(
        (sum, product) => sum + (product.amount ?? 0),
        0,
      ),
    0,
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unable to load daily history.";
}

export default function CustomerDailyHistoryTab({
  customerId,
  outstandingAmount,
  initialDate,
  showGenerateBill = false,
}: Props) {
  const getInitialMonth = () => {
    if (!initialDate) {
      return INITIAL_MONTH;
    }

    const [year, month] = initialDate.slice(0, 10).split("-").map(Number);

    return year && month >= 1 && month <= 12 ? month : INITIAL_MONTH;
  };

  const getInitialYear = () => {
    if (!initialDate) {
      return INITIAL_YEAR;
    }

    const year = Number(initialDate.slice(0, 4));

    return year >= 1 ? year : INITIAL_YEAR;
  };

  const [selectedMonth, setSelectedMonth] = useState(getInitialMonth);
  const [selectedYear, setSelectedYear] = useState(getInitialYear);

  useEffect(() => {
    if (!initialDate) {
      return;
    }

    const [year, month] = initialDate.slice(0, 10).split("-").map(Number);

    if (year && month >= 1 && month <= 12) {
      setSelectedMonth(month);
      setSelectedYear(year);
    }
  }, [initialDate]);

  const { data, isPending, isError, error, isFetching, refetch } =
    useCustomerDailyHistoryQuery(customerId, {
      month: selectedMonth,
      year: selectedYear,
    });

  const selectedMonthLabel = useMemo(
    () => MONTH_FORMATTER.format(new Date(selectedYear, selectedMonth - 1, 1)),
    [selectedMonth, selectedYear],
  );

  const monthItems = useMemo(() => {
    if (!data?.items?.length) {
      return [];
    }

    return [...data.items].sort(
      (a, b) =>
        new Date(a.ledgerDate).getTime() - new Date(b.ledgerDate).getTime(),
    );
  }, [data?.items]);

  // Read once at mount: a clock read inside the memo below would make it
  // impure, and the day cannot change while the table is open.
  const [todayKey] = useState(businessToday);

  const dayRows = useMemo<DayRow[]>(() => {
    if (!monthItems.length) {
      return [];
    }

    const byDate = new Map(
      monthItems.map((item) => [toDateKey(item.ledgerDate), item]),
    );

    const daysInMonth = new Date(
      Date.UTC(selectedYear, selectedMonth, 0),
    ).getUTCDate();

    const rows: DayRow[] = [];

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(Date.UTC(selectedYear, selectedMonth - 1, day));
      const dateKey = date.toISOString().slice(0, 10);

      // Days that have not happened yet are not missing entries.
      if (dateKey > todayKey) break;

      rows.push({ dateKey, date, item: byDate.get(dateKey) ?? null });
    }

    return rows;
  }, [monthItems, selectedMonth, selectedYear, todayKey]);

  const monthSummary = useMemo(() => {
    const milkSummary = buildMilkSummary(monthItems);

    const productSummary = buildProductSummary(monthItems);

    const milkTotal = milkSummary.reduce((sum, item) => sum + item.amount, 0);

    const productTotal = productSummary.reduce(
      (sum, item) => sum + item.amount,
      0,
    );

    return {
      milkSummary,
      productSummary,
      milkTotal,
      productTotal,
      purchaseTotal: milkTotal + productTotal,
    };
  }, [monthItems]);

  const outstanding = outstandingAmount ?? 0;

  const { can } = usePermissions();
  const generateBill = useGenerateBillMutation();
  const [confirmingGenerate, setConfirmingGenerate] = useState(false);

  const canGenerateBill = showGenerateBill && can(PERMISSIONS.BILL_GENERATE);

  function handleGenerateBill() {
    generateBill.mutate(
      { customerId, month: selectedMonth, year: selectedYear },
      {
        onSuccess: (bill) => {
          setConfirmingGenerate(false);
          toast.success(
            `Bill ${bill.billNumber} generated for ${selectedMonthLabel}.`,
          );
        },
        // The message from the API is already shown by the global handler; a
        // bill that exists for this month is the usual reason.
        onError: () => setConfirmingGenerate(false),
      },
    );
  }

  function shiftMonth(delta: number) {
    const nextDate = new Date(selectedYear, selectedMonth - 1 + delta, 1);

    setSelectedMonth(nextDate.getMonth() + 1);
    setSelectedYear(nextDate.getFullYear());
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex w-full max-w-sm items-center justify-between overflow-hidden rounded-lg border sm:w-auto sm:min-w-65">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="px-2 text-sm font-medium sm:text-base">
            {selectedMonthLabel}
          </span>

          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {isFetching && !isPending ? (
            <span className="text-xs text-neutral-500">Updating…</span>
          ) : null}

          {canGenerateBill ? (
            confirmingGenerate ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-600">
                  Generate the {selectedMonthLabel} bill?
                </span>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleGenerateBill}
                  disabled={generateBill.isPending}
                >
                  {generateBill.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Confirm"
                  )}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmingGenerate(false)}
                  disabled={generateBill.isPending}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setConfirmingGenerate(true)}
              >
                <ReceiptText className="mr-2 h-4 w-4" />
                Generate Bill
              </Button>
            )
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-[#F6F6F6]">
            <TableRow>
              <TableHead className="border-r text-center">Date</TableHead>

              <TableHead className="border-r text-center">
                Milk Purchases
              </TableHead>

              <TableHead className="border-r text-center">
                Product Purchases
              </TableHead>

              <TableHead className="w-35 text-center">Total</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isPending ? (
              <DataTableSkeleton columns={4} rows={4} />
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={4} className="p-0">
                  <QueryErrorState
                    error={getErrorMessage(error)}
                    onRetry={() => void refetch()}
                  />
                </TableCell>
              </TableRow>
            ) : dayRows.length ? (
              dayRows.map(({ dateKey, date, item }) => {
                // Someone checked this day and the customer bought nothing, which is
                // a different statement from a day nobody has reached yet.
                const isNoPurchase =
                  item?.noPurchase === true && item.entries.length === 0;

                // A day with nothing recorded still gets a row, so the table
                // reads as the whole month and a gap is visibly a gap.
                if (!item || item.entries.length === 0) {
                  return (
                    <TableRow
                      key={item?.id ?? dateKey}
                      className={isNoPurchase ? undefined : "bg-neutral-50/60"}
                    >
                      <TableCell className="border-r align-top">
                        <div
                          className={`text-sm font-medium ${
                            isNoPurchase
                              ? "text-neutral-700"
                              : "text-neutral-500"
                          }`}
                        >
                          {DATE_FORMATTER.format(date)}
                        </div>

                        <div className="text-xs text-neutral-400">
                          {WEEKDAY_FORMATTER.format(date)}
                        </div>
                      </TableCell>

                      <TableCell className="border-r text-center">
                        {isNoPurchase ? (
                          <span className="text-xs font-medium text-emerald-700">
                            No purchase
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </TableCell>

                      <TableCell className="border-r text-center text-neutral-400">
                        —
                      </TableCell>

                      <TableCell className="text-center">
                        {isNoPurchase ? (
                          <span className="text-sm text-neutral-600">
                            {formatCurrency(0)}
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                }

                const milkEntries = item.entries.flatMap(
                  (entry) => entry.milkEntries ?? [],
                );

                const productEntries = item.entries.flatMap(
                  (entry) => entry.productEntries ?? [],
                );

                const dailyTotal = getDailyTotal(item);

                return (
                  <TableRow key={item.id}>
                    <TableCell className="border-r align-top">
                      <div className="text-sm font-medium text-neutral-900">
                        {DATE_FORMATTER.format(date)}
                      </div>

                      <div className="text-xs text-neutral-500">
                        {WEEKDAY_FORMATTER.format(date)}
                      </div>
                    </TableCell>

                    <TableCell className="border-r align-top">
                      {milkEntries.length ? (
                        <div className="space-y-2">
                          {milkEntries.map((milk, index) => (
                            <div
                              key={`${item.id}-milk-${milk.milkTypeId}-${index}`}
                              className="space-y-1"
                            >
                              <Badge
                                variant="secondary"
                                className="bg-blue-50 font-semibold text-[#266699]"
                              >
                                {milk.milkTypeName}
                              </Badge>

                              <div className="text-sm font-medium text-neutral-600">
                                {milk.litres.toFixed(2)} Ltr
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </TableCell>

                    <TableCell className="border-r align-top">
                      {productEntries.length ? (
                        <div className="space-y-2">
                          {productEntries.map((product, index) => (
                            <div
                              key={`${item.id}-product-${product.itemName}-${index}`}
                              className="flex items-start justify-between gap-3 text-sm"
                            >
                              <span className="min-w-0 font-medium text-neutral-600">
                                <span aria-hidden="true">• </span>
                                <span className="wrap-break-word">
                                  {product.itemName} × {product.quantity}
                                </span>
                              </span>

                              <span className="shrink-0 font-medium text-neutral-800">
                                {formatCurrency(product.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </TableCell>

                    <TableCell className="align-top text-center">
                      <span className="text-xs font-medium text-neutral-500">
                        Total
                      </span>

                      <span className="mt-1 block text-base font-semibold text-neutral-800">
                        {formatCurrency(dailyTotal)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-32 text-center text-sm text-neutral-500"
                >
                  No purchase history available for this month.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <section className="rounded-lg border px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="font-bold text-[#266699]">
              Month&apos;s Summary
            </span>

            <span className="text-sm font-semibold text-neutral-500">
              ({selectedMonthLabel})
            </span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4 border-b py-2 font-bold">
              <span>Details</span>
              <span>Amount</span>
            </div>

            {monthSummary.milkSummary.map((milk) => (
              <div
                key={`${milk.milkTypeId}-${milk.rate}`}
                className="flex items-start justify-between gap-4"
              >
                <span className="min-w-0 font-medium">
                  {milk.litres.toFixed(2)} Ltr × {milk.milkTypeName} (
                  {formatCurrency(milk.rate)}
                  /Ltr)
                </span>

                <span className="shrink-0 font-medium">
                  {formatCurrency(milk.amount)}
                </span>
              </div>
            ))}

            <div className="flex items-center justify-between gap-4">
              <span>Other Items Total</span>
              <span>{formatCurrency(monthSummary.productTotal)}</span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span>Total Milk</span>
              <span>{formatCurrency(monthSummary.milkTotal)}</span>
            </div>

            <div className="flex items-center justify-between gap-4 border-y py-3">
              <span className="font-semibold text-red-500">Previous Due</span>

              <span className="font-semibold text-red-500">—</span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span>Paid</span>
              <span>—</span>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md bg-blue-50 px-3 py-3 text-lg font-bold text-[#266699] sm:text-xl">
              <span>Final Total</span>

              <span className="shrink-0">
                {formatCurrency(monthSummary.purchaseTotal)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border bg-neutral-50 px-3 py-3 font-semibold">
              <span>Outstanding</span>

              <span
                className={
                  outstanding > 0 ? "text-red-500" : "text-emerald-600"
                }
              >
                {formatCurrency(outstanding)}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-start gap-2 rounded-lg border bg-blue-50 px-3 py-3 text-sm text-neutral-600 sm:px-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#266699]" />

        <p className="min-w-0">
          Use the arrows to switch months and review the full ledger breakdown.
        </p>
      </div>
    </div>
  );
}
