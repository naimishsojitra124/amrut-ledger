import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  Phone,
  Plus,
  ReceiptText,
  UserRound,
} from "lucide-react";

import { useBillPaymentsQuery, useBillQuery } from "@/services/bill.service";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { formatCurrency } from "@/utils/format-currency";
import { cn } from "@/lib/utils";
import { useModalStore } from "@/store/modal.store";

type BillDetailsContentProps = {
  billId: string | null;
};

type SectionShellProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
  rightAction?: React.ReactNode;
};

const INITIAL_PAYMENT_LIMIT = 5;
const PAYMENT_LIMIT_INCREMENT = 5;

export default function BillDetailsContent({
  billId,
}: BillDetailsContentProps) {
  const openPayment = useModalStore((state) => state.openPayment);
  const [paymentLimit, setPaymentLimit] = useState(INITIAL_PAYMENT_LIMIT);

  // Reset payment pagination whenever a different bill is opened.
  useEffect(() => {
    setPaymentLimit(INITIAL_PAYMENT_LIMIT);
  }, [billId]);

  // Bill Details
  const {
    data: bill,
    isLoading: isBillLoading,
    isFetching: isBillFetching,
    isError: isBillError,
    error: billError,
  } = useBillQuery(billId);

  // Payment History
  const {
    data: paymentData,
    isLoading: isPaymentsLoading,
    isFetching: isPaymentsFetching,
    isError: isPaymentsError,
    error: paymentsError,
  } = useBillPaymentsQuery(billId, {
    page: 1,
    limit: paymentLimit,
  });

  //Derived bill values
  const customer = bill?.customer ?? null;

  const currentCardNumber = bill?.cardAssignment?.cardNumber ?? null;

  const customerInitials = useMemo(() => {
    const fullName = customer?.fullName;

    if (!fullName) {
      return "Joh Doe";
    }

    return fullName
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [customer?.fullName]);

  const billNumber = bill?.billNumber ?? "-";

  const billMonthLabel = useMemo(() => {
    if (!bill) {
      return "-";
    }

    return new Date(bill.year, bill.month - 1).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
  }, [bill]);

  const billDateLabel = useMemo(() => {
    if (!bill) {
      return "-";
    }

    return new Date(bill.billDate).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, [bill]);

  const billDateTimeLabel = useMemo(() => {
    if (!bill) {
      return "-";
    }

    return new Date(bill.billDate).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [bill]);

  const totalPaid = bill?.totalPaid ?? 0;
  const outstanding = bill?.outstandingAmount ?? 0;
  const grandTotal = bill?.grandTotal ?? 0;

  const milkRows = bill?.milkSummary ?? [];
  const otherItems = bill?.otherItems ?? [];

  const paymentRows = paymentData?.items ?? [];

  const hasMorePayments = paymentData?.pageInfo?.hasNextPage ?? false;

  const billGeneratedBy = useMemo(() => {
    if (!bill?.generatedBy) {
      return "Unknown";
    }

    if (
      typeof bill.generatedBy === "object" &&
      "fullName" in bill.generatedBy
    ) {
      return (
        (bill.generatedBy as { fullName?: string }).fullName?.split(" ")[0] ??
        "Unknown"
      );
    }

    return "Unknown";
  }, [bill?.generatedBy]);

  // Loading state
  if (isBillLoading) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="text-center">
          <ReceiptText className="mx-auto h-10 w-10 animate-pulse text-neutral-300" />

          <p className="mt-3 text-sm font-medium text-neutral-900">
            Loading bill...
          </p>

          <p className="mt-1 text-sm text-neutral-500">
            Fetching bill details.
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (isBillError) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div>
          <ReceiptText className="mx-auto h-10 w-10 text-red-300" />

          <p className="mt-3 text-sm font-medium text-neutral-900">
            Failed to load bill
          </p>

          <p className="mt-1 text-sm text-red-500">
            {billError instanceof Error
              ? billError.message
              : "Unable to load bill details."}
          </p>
        </div>
      </div>
    );
  }

  // Bill not found
  if (!bill) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div>
          <ReceiptText className="mx-auto h-10 w-10 text-neutral-300" />

          <p className="mt-3 text-sm font-medium text-neutral-900">
            Bill not found
          </p>

          <p className="mt-1 text-sm text-neutral-500">
            Select a bill from the table to view its details.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex items-start justify-between border-b px-4 py-4">
        <div>
          <h2 className="text-[17px] font-semibold text-neutral-900">
            Bill Details
          </h2>
        </div>

        <BillStatusBadge status={bill.status} />
      </div>

      {/* Scrollable Body */}
      <div className="hide-scrollbar flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          {/* Bill Number / View Ledger */}
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <p className="text-xs text-neutral-500">Bill No.</p>

              <p className="text-[15px] font-semibold text-neutral-900">
                {billNumber}
              </p>
            </div>

            {/* <Button variant="outline" className="gap-2 rounded-md">
              <Eye className="h-4 w-4" />
              View Ledger
            </Button> */}
          </div>

          {/* Customer Header */}
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11">
                <AvatarFallback className="bg-neutral-400 text-base font-medium text-white">
                  {customerInitials}
                </AvatarFallback>
              </Avatar>

              <div>
                <p className="text-[15px] font-semibold text-neutral-900">
                  {customer?.fullName ?? "-"}
                </p>

                <p className="text-xs text-neutral-500">
                  Card No. {currentCardNumber ?? "-"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <Phone className="h-4 w-4" />

              <span className="font-medium">
                {customer?.mobileNumber ?? "-"}
              </span>
            </div>
          </div>

          {/* Month / Bill Date */}
          <div className="flex border-b pb-4 text-sm">
            <div className="flex flex-1 flex-col items-center justify-center gap-1 border-r">
              <p className="text-xs text-neutral-500">Month / Year</p>

              <p className="text-sm font-semibold text-neutral-900">
                {billMonthLabel}
              </p>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center gap-1">
              <p className="text-xs text-neutral-500">Bill Date</p>

              <p className="text-sm font-semibold text-neutral-900">
                {billDateLabel}
              </p>
            </div>
          </div>

          {/* Amount Summary */}
          <SectionShell title="Amount Summary">
            <div className="space-y-3">
              <div>
                {milkRows.map((milk) => (
                  <SummaryRow
                    key={`${milk.milkTypeName}-${milk.rate}`}
                    label={milk.milkTypeName}
                    value={formatCurrency(milk.amount)}
                    secondary={`${milk.litres.toFixed(
                      2,
                    )} Ltr × ${formatCurrency(milk.rate)}/Ltr`}
                  />
                ))}

                <SummaryRow
                  label="Other Items Total"
                  value={formatCurrency(bill.otherItemsTotal)}
                />

                <SummaryRow
                  label="Previous Due"
                  value={formatCurrency(bill.previousDue)}
                  labelClassName="text-neutral-600"
                />
              </div>

              <div className="rounded-xl bg-blue-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[15px] font-semibold text-[#266699]">
                    Grand Total
                  </span>

                  <span className="text-[17px] font-bold text-[#266699]">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>

                <div className="mt-2 space-y-1">
                  <SummaryRow
                    label="Paid Amount"
                    value={formatCurrency(totalPaid)}
                    compact
                    valueClassName="text-emerald-700"
                  />

                  <SummaryRow
                    label="Outstanding"
                    value={formatCurrency(outstanding)}
                    compact
                    valueClassName={
                      outstanding > 0 ? "text-red-600" : "text-emerald-700"
                    }
                  />
                </div>
              </div>
            </div>
          </SectionShell>

          {/* Milk Summary */}
          <SectionShell title="Milk Summary">
            <div className="space-y-2">
              <div className="grid grid-cols-[1.25fr_0.6fr_0.6fr_0.8fr] gap-3 border-b pb-2 text-xs font-medium text-neutral-500">
                <span>Milk Type</span>

                <span className="text-right">Qty (Ltr)</span>

                <span className="text-right">Rate (₹/Ltr)</span>

                <span className="text-right">Amount (₹)</span>
              </div>

              {milkRows.length > 0 ? (
                milkRows.map((milk) => (
                  <div
                    key={`${milk.milkTypeName}-${milk.rate}`}
                    className="grid grid-cols-[1.25fr_0.6fr_0.6fr_0.8fr] gap-3 py-0.5 text-sm"
                  >
                    <span className="font-medium text-neutral-700">
                      {milk.milkTypeName}
                    </span>

                    <span className="text-right text-neutral-600">
                      {milk.litres.toFixed(2)}
                    </span>

                    <span className="text-right text-neutral-600">
                      {formatCurrency(milk.rate)}
                    </span>

                    <span className="text-right font-semibold text-neutral-900">
                      {formatCurrency(milk.amount)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-sm text-neutral-500">
                  No milk items found.
                </div>
              )}

              <div className="grid grid-cols-[1.25fr_0.6fr_0.6fr_0.8fr] gap-3 border-t pt-2 text-sm">
                <span className="font-semibold text-neutral-700">
                  Total Milk
                </span>

                <span className="text-right font-semibold text-neutral-700">
                  {bill.totalMilkLitres.toFixed(2)}
                </span>

                <span />

                <span className="text-right font-bold text-neutral-900">
                  {formatCurrency(
                    milkRows.reduce((sum, item) => sum + item.amount, 0),
                  )}
                </span>
              </div>
            </div>
          </SectionShell>

          {/* Other Items */}
          <SectionShell title="Other Items">
            <div className="space-y-2">
              <div className="grid grid-cols-[1.25fr_0.6fr_0.6fr_0.8fr] gap-3 border-b pb-2 text-xs font-medium text-neutral-500">
                <span>Item</span>

                <span className="text-right">Qty</span>

                <span className="text-right">Rate (₹)</span>

                <span className="text-right">Amount (₹)</span>
              </div>

              {otherItems.length > 0 ? (
                otherItems.map((item) => (
                  <div
                    key={`${item.itemName}-${item.quantity}-${item.unitPrice}`}
                    className="grid grid-cols-[1.25fr_0.6fr_0.6fr_0.8fr] gap-3 py-0.5 text-sm"
                  >
                    <span className="font-medium text-neutral-700">
                      {item.itemName}
                    </span>

                    <span className="text-right text-neutral-600">
                      {item.quantity}
                    </span>

                    <span className="text-right text-neutral-600">
                      {formatCurrency(item.unitPrice)}
                    </span>

                    <span className="text-right font-semibold text-neutral-900">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-sm text-neutral-500">
                  No other items found.
                </div>
              )}

              <div className="grid grid-cols-[1.25fr_0.6fr_0.6fr_0.8fr] gap-3 border-t pt-2 text-sm">
                <span className="font-semibold text-neutral-700">
                  Other Items
                </span>

                <span className="text-right text-neutral-500">—</span>

                <span className="text-right text-neutral-500">—</span>

                <span className="text-right font-bold text-neutral-900">
                  {formatCurrency(bill.otherItemsTotal)}
                </span>
              </div>
            </div>
          </SectionShell>

          {/* Payment History */}
          <SectionShell
            title="Payment History"
            rightAction={
              <Button
                className="h-8 gap-2 rounded-md px-3 text-xs"
                disabled={outstanding <= 0}
                onClick={() =>
                  openPayment({ billId: bill.id, customerId: bill.customerId })
                }
              >
                <Plus className="h-4 w-4" />
                Add Payment
              </Button>
            }
          >
            {isPaymentsLoading ? (
              <div className="py-6 text-center text-sm text-neutral-500">
                Loading payments...
              </div>
            ) : isPaymentsError ? (
              <div className="py-6 text-center">
                <p className="text-sm font-medium text-neutral-700">
                  Failed to load payments
                </p>

                <p className="mt-1 text-xs text-red-500">
                  {paymentsError instanceof Error
                    ? paymentsError.message
                    : "Unable to load payment history."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-[1.05fr_0.8fr_0.6fr_0.8fr] gap-2 border-b pb-2 text-xs font-medium text-neutral-500">
                  <span>Date &amp; Time</span>

                  <span className="text-center">Amount (₹)</span>

                  <span className="text-center">Mode</span>

                  <span className="text-center">Received By</span>
                </div>

                {paymentRows.length > 0 ? (
                  paymentRows.map((payment, index) => {
                    const receivedBy = getReceivedByName(payment.receivedBy);

                    return (
                      <div
                        key={payment.id ?? `${payment.receivedAt}-${index}`}
                        className="grid grid-cols-[1.05fr_0.8fr_0.6fr_0.8fr] items-center gap-2 py-1.5 text-sm"
                      >
                        <div>
                          <div className="font-medium text-neutral-700">
                            {new Date(payment.receivedAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </div>

                          <div className="text-xs text-neutral-500">
                            {new Date(payment.receivedAt).toLocaleTimeString(
                              "en-IN",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </div>
                        </div>

                        <span className="text-center font-semibold text-emerald-700">
                          {formatCurrency(payment.amount)}
                        </span>

                        <div className="text-center">
                          <ModeBadge method={payment.paymentMethod} />
                        </div>

                        <span className="text-center text-neutral-600">
                          {receivedBy}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-4 text-center text-sm text-neutral-500">
                    No payments recorded yet.
                  </div>
                )}

                {hasMorePayments && (
                  <Button
                    variant="outline"
                    className="h-10 w-full gap-2 rounded-md"
                    disabled={isPaymentsFetching}
                    onClick={() =>
                      setPaymentLimit(
                        (previous) => previous + PAYMENT_LIMIT_INCREMENT,
                      )
                    }
                  >
                    <ChevronDown className="h-4 w-4" />

                    {isPaymentsFetching
                      ? "Loading Payments..."
                      : "View More Payments"}
                  </Button>
                )}
              </div>
            )}
          </SectionShell>

          {/* Footer */}
          <div className="flex items-center justify-between rounded-lg border bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
            <div className="flex items-center gap-2">
              <UserRound className="h-4 w-4" />

              <span>Generated by {billGeneratedBy}</span>
            </div>

            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />

              <span>{billDateTimeLabel}</span>
            </div>
          </div>

          {isBillFetching && (
            <p className="pb-1 text-center text-xs text-neutral-400">
              Updating bill...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper Components
function SectionShell({
  title,
  children,
  className,
  rightAction,
}: SectionShellProps) {
  return (
    <div
      className={cn("overflow-hidden rounded-lg border bg-white", className)}
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-lg font-bold text-[#266699]">{title}</h3>

        {rightAction}
      </div>

      <div className="p-3">{children}</div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  secondary,
  compact,
  labelClassName,
  valueClassName,
}: {
  label: string;
  value: string;
  secondary?: string;
  compact?: boolean;
  labelClassName?: string;
  valueClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4",
        compact ? "py-1" : "py-1.5",
      )}
    >
      <div>
        <p
          className={cn("text-sm font-medium text-neutral-700", labelClassName)}
        >
          {label}
        </p>

        {secondary && (
          <p className="mt-0.5 text-xs text-neutral-500">{secondary}</p>
        )}
      </div>

      <p
        className={cn(
          "shrink-0 text-sm font-semibold text-neutral-900",
          valueClassName,
        )}
      >
        {value}
      </p>
    </div>
  );
}

function BillStatusBadge({
  status,
}: {
  status: "paid" | "partial" | "unpaid";
}) {
  if (status === "paid") {
    return (
      <Badge className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100">
        Paid
      </Badge>
    );
  }

  if (status === "partial") {
    return (
      <Badge className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100">
        Partially Paid
      </Badge>
    );
  }

  return (
    <Badge className="rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-100">
      Unpaid
    </Badge>
  );
}

function ModeBadge({ method }: { method: "cash" | "upi" }) {
  if (method === "cash") {
    return (
      <Badge className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100">
        Cash
      </Badge>
    );
  }

  return (
    <Badge className="rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700 hover:bg-violet-100">
      UPI
    </Badge>
  );
}

function getReceivedByName(receivedBy: unknown) {
  if (!receivedBy) {
    return "—";
  }

  if (
    typeof receivedBy === "object" &&
    receivedBy !== null &&
    "fullName" in receivedBy
  ) {
    const fullName = (
      receivedBy as {
        fullName?: string;
      }
    ).fullName;

    return fullName?.split(" ")[0] ?? "—";
  }

  return "—";
}
