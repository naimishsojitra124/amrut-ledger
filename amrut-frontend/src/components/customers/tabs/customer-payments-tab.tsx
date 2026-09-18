import { useMemo, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Info,
  Loader2,
  Plus,
  Printer,
  Wallet,
} from "lucide-react";

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
import {
  useCustomerPaymentsQuery,
} from "@/services/customer.service";
import type { CustomerPaymentItemResponse } from "@/types/customer";
import { useModalStore } from "@/store/modal.store";
import { formatCurrency } from "@/utils/format-currency";
import { generatePaymentHistoryPdf } from "@/utils/generate-payment-history-pdf";

type Props = {
  customerId: string;
  customer?: {
    fullName: string;
    cardNumber?: number;
    depositAmount?: number;
  };
};

const DATE_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
});

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  year: "numeric",
});

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

type PaymentRow = {
  payment: CustomerPaymentItemResponse;
  dateLabel: string;
  timeLabel: string;
  billMonthLabel: string;
};

export default function CustomerPaymentsTab({ customerId, customer }: Props) {
  const openOutstandingLedger = useModalStore(
    (state) => state.openOutstandingLedger,
  );
  const openPayment = useModalStore((state) => state.openPayment);

  const [pageIndex, setPageIndex] = useState(0);
  const PAGE_SIZE = 10;

  const {
    data,
    isPending: isPaymentsPending,
    isError,
    error,
    isFetching,
  } = useCustomerPaymentsQuery(customerId, {
    page: pageIndex + 1,
    limit: PAGE_SIZE,
  });

  const customerPayments = useMemo(
    () =>
      [...(data?.items ?? [])].sort(
        (a, b) =>
          new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
      ),
    [data?.items],
  );

  const paymentRows = useMemo<PaymentRow[]>(
    () =>
      customerPayments.map((payment) => {
        const receivedAt = new Date(payment.receivedAt);

        return {
          payment,
          dateLabel: DATE_FORMATTER.format(receivedAt),
          timeLabel: TIME_FORMATTER.format(receivedAt),
          billMonthLabel: MONTH_FORMATTER.format(
            new Date(payment.billYear, payment.billMonth - 1, 1),
          ),
        };
      }),
    [customerPayments],
  );

  const summary = data?.summary ?? {
    totalPaid: 0,
    totalBilled: 0,
    outstanding: 0,
    totalPayments: 0,
    lastPaymentAt: null,
    outstandingBillCount: 0,
  };

  const nextOutstandingBill = data?.nextOutstandingBill ?? null;
  const pageInfo = data?.pageInfo;
  const totalPages = pageInfo?.totalPages ?? 1;

  const visiblePages = useMemo(() => {
    if (totalPages <= 0) return [];

    const current = pageIndex + 1;
    const start = Math.max(1, Math.min(current - 1, totalPages - 2));
    const end = Math.min(totalPages, start + 2);

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [pageIndex, totalPages]);

  function goToPage(pageNumber: number) {
    if (
      pageNumber < 1 ||
      pageNumber > totalPages ||
      pageNumber === pageIndex + 1
    )
      return;
    setPageIndex(pageNumber - 1);
  }

  function goToPreviousPage() {
    if (!pageInfo?.hasPreviousPage) return;
    setPageIndex((page) => Math.max(0, page - 1));
  }

  function goToNextPage() {
    if (!pageInfo?.hasNextPage) return;
    setPageIndex((page) => page + 1);
  }

  const handleAddPayment = () => {
    if (nextOutstandingBill) {
      openPayment({
        billId: nextOutstandingBill.id,
        customerId,
      });
    }
  };

  const handlePrintPaymentHistory = () => {
    generatePaymentHistoryPdf({
      payments: customerPayments,
      customer: {
        id: customerId,
        fullName: customer?.fullName ?? "Customer",
        cardNumber: customer?.cardNumber,
      },
      business: {
        name: "Amrut Dairy Farm",
        address: "Gandhigram, 80ft Road, Rajkot, Gujarat",
      },
      summary: {
        totalBilled: summary.totalBilled,
        totalPaid: summary.totalPaid,
        outstanding: summary.outstanding,
        totalPayments: summary.totalPayments,
      },
    });
  };

  if (isPaymentsPending) {
    return (
      <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-neutral-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading payments...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-40 items-center justify-center px-4 text-center text-sm text-red-600">
        {getErrorMessage(error, "Failed to load customer payments.")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          label="Total Paid"
          value={formatCurrency(summary.totalPaid)}
          valueClassName="text-emerald-600"
        />

        <SummaryCard
          label="Outstanding"
          value={formatCurrency(summary.outstanding)}
          valueClassName={
            summary.outstanding > 0 ? "text-red-500" : "text-emerald-600"
          }
        />

        <SummaryCard
          label="Total Payments"
          value={String(summary.totalPayments)}
        />

        <SummaryCard
          label="Last Payment"
          value={
            summary.lastPaymentAt
              ? DATE_FORMATTER.format(new Date(summary.lastPaymentAt))
              : "—"
          }
        />
      </div>

      <Button
        size="lg"
        className="w-full gap-2 rounded-md"
        type="button"
        disabled={!nextOutstandingBill}
        onClick={handleAddPayment}
      >
        <Plus className="h-4 w-4" />
        Add Payment
      </Button>

      <div className="overflow-hidden rounded-lg border">
        <div className="flex flex-col gap-1 border-b px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold text-[#266699]">Payment History</span>

          {isFetching && (
            <span className="text-xs text-neutral-500">Updating...</span>
          )}
        </div>

        {customerPayments.length > 0 ? (
          <div className="overflow-x-auto">
            <Table className="min-w-180">
              <TableHeader className="bg-[#F6F6F6]">
                <TableRow>
                  <TableHead>Date &amp; Time</TableHead>
                  <TableHead>Bill</TableHead>
                  <TableHead>Amount (₹)</TableHead>
                  <TableHead>Payment Mode</TableHead>
                  <TableHead>Received By</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {paymentRows.map(
                  ({ payment, dateLabel, timeLabel, billMonthLabel }) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{dateLabel}</span>
                          <span className="text-xs text-neutral-500">
                            {timeLabel}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {payment.bill.billNumber}
                          </span>
                          <span className="text-xs text-neutral-500">
                            {billMonthLabel}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="font-semibold">
                        <div>{formatCurrency(payment.creditedAmount)}</div>

                        {payment.depositUsed > 0 && (
                          <div className="text-xs font-normal text-neutral-500">
                            Deposit {formatCurrency(payment.depositUsed)}
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        {payment.paymentMethod === "cash" ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            <Wallet className="mr-1 h-3 w-3" />
                            Cash
                          </Badge>
                        ) : (
                          <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100">
                            <CreditCard className="mr-1 h-3 w-3" />
                            UPI
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell>{payment.receivedBy.fullName}</TableCell>
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex min-h-24 items-center justify-center px-4 text-center text-sm text-neutral-500">
            No payment history available.
          </div>
        )}

        <div className="flex flex-col gap-3 border-t px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-neutral-500">
            Showing {customerPayments.length ? pageIndex * PAGE_SIZE + 1 : 0} to{" "}
            {customerPayments.length
              ? pageIndex * PAGE_SIZE + customerPayments.length
              : 0}{" "}
            of {pageInfo?.totalItems ?? 0} payments
            {isFetching ? " • Updating..." : ""}
          </p>

          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="icon"
              type="button"
              onClick={goToPreviousPage}
              disabled={!pageInfo?.hasPreviousPage}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1">
              {visiblePages.map((pageNumber) => (
                <Button
                  key={pageNumber}
                  type="button"
                  variant={pageIndex + 1 === pageNumber ? "default" : "outline"}
                  className="h-9 w-9 p-0"
                  onClick={() => goToPage(pageNumber)}
                  aria-label={`Go to page ${pageNumber}`}
                >
                  {pageNumber}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="icon"
              type="button"
              onClick={goToNextPage}
              disabled={!pageInfo?.hasNextPage}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-1 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold text-[#266699]">Payment Summary</span>
          <span className="text-xs text-neutral-500 sm:text-sm">
            Current customer
          </span>
        </div>

        <div className="space-y-3 pt-3 text-sm">
          <SummaryLine
            label="Total Billed"
            value={formatCurrency(summary.totalBilled)}
          />

          <SummaryLine
            label="Total Paid"
            value={formatCurrency(summary.totalPaid)}
            valueClassName="text-emerald-600"
          />

          <SummaryLine
            label="Outstanding"
            value={formatCurrency(summary.outstanding)}
            valueClassName="text-red-500"
          />
        </div>
      </div>

      <div className="rounded-lg border px-3 py-3 sm:px-4">
        <span className="font-semibold text-[#266699]">Quick Actions</span>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            className="h-auto min-h-10 gap-2 whitespace-normal"
            type="button"
            disabled={summary.outstandingBillCount === 0}
            onClick={() =>
              openOutstandingLedger({
                customerId,
                customerName: customer?.fullName,
              })
            }
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            View Outstanding Ledger
          </Button>

          <Button
            variant="outline"
            className="h-auto min-h-10 gap-2 whitespace-normal"
            type="button"
            disabled={customerPayments.length === 0}
            onClick={handlePrintPaymentHistory}
          >
            <Printer className="h-4 w-4 shrink-0" />
            Print Payment History
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border bg-blue-50 px-3 py-3 text-sm text-neutral-600 sm:px-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#266699]" />

        <p>
          <span className="font-semibold text-[#266699]">Tip:</span> Payment
          details and receipts can be opened from the payment workflow.
        </p>
      </div>

      {summary.outstandingBillCount > 0 && (
        <div className="rounded-lg border bg-red-50/50 px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-neutral-600">
              Outstanding Bills
            </span>

            <span className="text-sm font-semibold text-red-600">
              {summary.outstandingBillCount} ·{" "}
              {formatCurrency(summary.outstanding)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

type SummaryCardProps = {
  label: string;
  value: string;
  valueClassName?: string;
};

function SummaryCard({ label, value, valueClassName }: SummaryCardProps) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg border bg-[#F6F6F6] p-3 text-center sm:p-4">
      <span className="text-xs font-semibold text-neutral-700">{label}</span>
      <span
        className={`max-w-full truncate text-sm font-semibold sm:text-base ${
          valueClassName ?? ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-neutral-600">{label}</span>
      <span className={`shrink-0 font-semibold ${valueClassName ?? ""}`}>
        {value}
      </span>
    </div>
  );
}
