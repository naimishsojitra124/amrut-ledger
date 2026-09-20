import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  Loader2,
  ScrollText,
} from "lucide-react";

import { QueryErrorState } from "@/components/common/query-error-state";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  getCustomerDailyHistory,
  useCustomerBillsQuery,
} from "@/services/customer.service";
import { useBillQuery } from "@/services/bill.service";
import { useGenerateBillMutation } from "@/services/bill.service";
import { useModalStore } from "@/store/modal.store";
import type { BillStatus, CustomerBillItemResponse } from "@/types/customer";
import { formatCurrency } from "@/utils/format-currency";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/permissions";
import { generateBillPdf } from "@/utils/generate-bill-pdf";

type CustomerBillPdfCustomer = {
  id?: string;
  fullName: string;
  cardNumber?: number;
  depositAmount?: number;
  mobile?: string;
  address?: string;
};

type Props = {
  customerId: string;
  customer?: CustomerBillPdfCustomer;
};

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
});

const DATE_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const DATETIME_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function getStatusContent(bill: CustomerBillItemResponse) {
  // An opening balance is a receivable brought over from paper. Labelling it
  // makes clear why it has no milk or item lines.
  if (bill.isOpeningBalance && bill.status !== "carried_forward") {
    return (
      <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-start sm:gap-1">
        <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
          Opening Balance
        </Badge>

        <span
          className={
            bill.outstandingAmount > 0 ? "text-xs text-red-500" : "text-xs text-neutral-500"
          }
        >
          {bill.outstandingAmount > 0
            ? `Due ${formatCurrency(bill.outstandingAmount)}`
            : "Settled"}
        </span>
      </div>
    );
  }

  switch (bill.status as BillStatus) {
    case "paid":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
          Paid
        </Badge>
      );

    case "carried_forward":
      return (
        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-start sm:gap-1">
          <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
            Carried Forward
          </Badge>

          <span className="text-xs text-neutral-500">
            Balance moved to a later bill
          </span>
        </div>
      );

    case "partial":
      return (
        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-start sm:gap-1">
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
            Partial
          </Badge>

          <span className="text-xs text-neutral-500">
            Paid {formatCurrency(bill.totalPaid)}
          </span>

          <span className="text-xs text-red-500">
            Due {formatCurrency(bill.outstandingAmount)}
          </span>
        </div>
      );

    default:
      return (
        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-start sm:gap-1">
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
            Unpaid
          </Badge>

          {bill.outstandingAmount > 0 ? (
            <span className="text-xs text-red-500">
              Due {formatCurrency(bill.outstandingAmount)}
            </span>
          ) : null}
        </div>
      );
  }
}

function getMonthLabel(year: number, month: number) {
  return MONTH_FORMATTER.format(new Date(year, month - 1, 1));
}

export default function CustomerBillsTab({ customerId, customer }: Props) {
  // Generating a bill closes off a month and carries balances forward, so it
  // sits with the roles that own the books rather than the counter.
  const { can } = usePermissions();
  const canGenerateBill = can(PERMISSIONS.BILL_GENERATE);

  const openGenerateBill = useModalStore((state) => state.openGenerateBill);

  const openPayment = useModalStore((state) => state.openPayment);

  const [expandedBillId, setExpandedBillId] = useState<string | undefined>();
  const [pageIndex, setPageIndex] = useState(0);

  const PAGE_SIZE = 10;

  const generateBillMutation = useGenerateBillMutation();

  const { data, isPending, isError, error, isFetching, refetch } =
    useCustomerBillsQuery(customerId, {
      page: pageIndex + 1,
      limit: PAGE_SIZE,
    });

  const {
    data: billDetail,
    isPending: isBillDetailPending,
    isError: isBillDetailError,
    refetch: refetchBillDetail,
  } = useBillQuery(expandedBillId ?? null);

  const customerBills = useMemo(
    () =>
      [...(data?.items ?? [])].sort(
        (a, b) =>
          new Date(b.year, b.month - 1, 1).getTime() -
          new Date(a.year, a.month - 1, 1).getTime(),
      ),
    [data?.items],
  );

  const summary = data?.summary ?? {
    totalBills: 0,
    totalBilled: 0,
    totalPaid: 0,
    outstanding: 0,
  };

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
    setExpandedBillId(undefined);
  }

  function goToPreviousPage() {
    if (!pageInfo?.hasPreviousPage) return;
    setPageIndex((page) => Math.max(0, page - 1));
    setExpandedBillId(undefined);
  }

  function goToNextPage() {
    if (!pageInfo?.hasNextPage) return;
    setPageIndex((page) => page + 1);
    setExpandedBillId(undefined);
  }

  async function handleViewBill() {
    if (!billDetail) {
      return;
    }

    try {
      const dailyHistory = await getCustomerDailyHistory(customerId, {
        month: billDetail.month,
        year: billDetail.year,
      });

      generateBillPdf({
        bill: billDetail,
        dailyHistory: dailyHistory.items,

        business: {
          name: "Amrut Dairy Farm",
          address: "Gandhigram, 80ft Road, Rajkot, Gujarat",
        },

        customer: {
          id: customer?.id ?? customerId,
          fullName: customer?.fullName ?? "Customer",
          cardNumber: customer?.cardNumber,
          mobile: customer?.mobile,
          address: customer?.address,
        },
      });
    } catch (pdfError) {
      console.error("Failed to generate bill PDF:", pdfError);
    }
  }

  function handleGenerateBill() {
    openGenerateBill({
      customerId,
      customerName: customer?.fullName,
    });
  }

  function handleOpenPayment() {
    if (!billDetail || billDetail.outstandingAmount <= 0) {
      return;
    }

    openPayment({
      billId: billDetail.id,
      customerId,
    });
  }

  return (
    <div className="space-y-3">
      <section className="overflow-hidden rounded-lg border">
        <div className="flex flex-col gap-3 border-b px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="min-w-0">
            <h3 className="font-semibold text-[#266699]">Monthly Bills</h3>

            <p className="text-sm text-neutral-500">
              All bills generated for this customer
            </p>
          </div>

          {canGenerateBill && (
            <Button
              type="button"
              className="w-full gap-2 sm:w-auto"
              onClick={handleGenerateBill}
              disabled={generateBillMutation.isPending}
            >
              {generateBillMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ScrollText className="h-4 w-4" />
              )}
              Generate Bill
            </Button>
          )}
        </div>

        {isPending ? (
          <div
            className="flex h-40 items-center justify-center gap-2 text-sm text-neutral-500"
            aria-busy="true"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading bills…
          </div>
        ) : isError ? (
          <QueryErrorState error={error} onRetry={() => void refetch()} />
        ) : customerBills.length ? (
          <>
            <div className="hidden border-b bg-[#F6F6F6] px-4 py-3 text-sm font-semibold lg:grid lg:grid-cols-[1.4fr_1.5fr_1fr_1fr_auto] lg:gap-4">
              <span>Month / Year</span>
              <span>Bill Details</span>
              <span>Amount</span>
              <span>Status</span>
              <span />
            </div>

            <Accordion
              type="single"
              collapsible
              value={expandedBillId}
              onValueChange={setExpandedBillId}
            >
              {customerBills.map((bill, index) => {
                const isExpanded = expandedBillId === bill.id;

                return (
                  <AccordionItem
                    key={bill.id}
                    value={bill.id}
                    className="border-b last:border-b-0"
                  >
                    <AccordionTrigger className="px-3 py-3 hover:no-underline sm:px-4 sm:py-4">
                      <div className="flex w-full min-w-0 flex-col gap-3 pr-2 lg:grid lg:grid-cols-[1.4fr_1.5fr_1fr_1fr_auto] lg:items-center lg:gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-3 lg:block">
                            <span className="truncate font-semibold text-[#266699]">
                              {getMonthLabel(bill.year, bill.month)}
                            </span>

                            {index === 0 ? (
                              <span className="shrink-0 text-xs text-[#266699] lg:block">
                                Latest Bill
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-1 text-left text-sm lg:block">
                          <span>
                            Milk: {bill.totalMilkLitres.toFixed(2)} Ltr
                          </span>

                          <span className="text-right text-neutral-500 lg:block lg:text-left">
                            Items: {bill.totalItemsCount}
                          </span>

                          <span className="col-span-2 truncate text-xs text-neutral-400">
                            {bill.billNumber}
                          </span>
                        </div>

                        <div className="font-semibold lg:text-left">
                          {formatCurrency(bill.grandTotal)}
                        </div>

                        <div className="flex justify-start">
                          {getStatusContent(bill)}
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="px-0">
                      <div className="px-3 pb-4 sm:px-4">
                        <div className="space-y-4 rounded-lg border p-3 sm:p-4">
                          <div className="flex items-center justify-between gap-4 border-b pb-3">
                            <span className="font-semibold">Bill Summary</span>

                            <span className="font-semibold">Amount</span>
                          </div>

                          {isExpanded && isBillDetailPending ? (
                            <div
                              className="flex items-center justify-center gap-2 py-6 text-sm text-neutral-500"
                              aria-busy="true"
                            >
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading bill details…
                            </div>
                          ) : isExpanded && isBillDetailError ? (
                            <div className="space-y-3">
                              <QueryErrorState
                                onRetry={() => void refetchBillDetail()}
                              />
                            </div>
                          ) : isExpanded && billDetail ? (
                            <>
                              {billDetail.milkSummary.length ? (
                                <div className="space-y-2">
                                  {billDetail.milkSummary.map((milk) => (
                                    <div
                                      key={`${billDetail.id}-${milk.milkTypeId}-${milk.rate}`}
                                      className="flex items-start justify-between gap-4 text-sm"
                                    >
                                      <span className="min-w-0 wrap-break-word">
                                        {milk.litres} Ltr × {milk.milkTypeName}{" "}
                                        ({formatCurrency(milk.rate)}
                                        /Ltr)
                                      </span>

                                      <span className="shrink-0 font-medium">
                                        {formatCurrency(milk.amount)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-neutral-500">
                                  No milk summary available.
                                </p>
                              )}

                              <div className="flex items-center justify-between gap-4">
                                <span>Other Items Total</span>

                                <span className="shrink-0">
                                  {formatCurrency(billDetail.otherItemsTotal)}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-4 border-y py-3">
                                <span className="font-semibold text-red-500">
                                  Previous Due
                                </span>

                                <span className="shrink-0 font-semibold text-red-500">
                                  {formatCurrency(billDetail.previousDue)}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-4">
                                <span>Paid</span>

                                <span className="shrink-0 font-medium">
                                  {formatCurrency(billDetail.totalPaid)}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-4 rounded-md bg-blue-50 px-3 py-3 text-lg font-bold text-[#266699] sm:text-2xl">
                                <span>Grand Total</span>

                                <span className="shrink-0">
                                  {formatCurrency(billDetail.grandTotal)}
                                </span>
                              </div>

                              {billDetail.outstandingAmount > 0 ? (
                                <div className="flex items-center justify-between gap-4 rounded-md border bg-neutral-50 px-3 py-3 text-base font-semibold">
                                  <span>Outstanding</span>

                                  <span className="shrink-0 text-red-500">
                                    {formatCurrency(
                                      billDetail.outstandingAmount,
                                    )}
                                  </span>
                                </div>
                              ) : null}

                              <div className="grid gap-2 text-sm text-neutral-500 sm:grid-cols-2">
                                <span>
                                  Bill Date:{" "}
                                  {DATE_FORMATTER.format(
                                    new Date(billDetail.billDate),
                                  )}
                                </span>

                                <span>
                                  Generated:{" "}
                                  {DATETIME_FORMATTER.format(
                                    new Date(billDetail.generatedAt),
                                  )}
                                </span>

                                <span className="min-w-0 break-all">
                                  Bill Number: {billDetail.billNumber}
                                </span>

                                <span className="min-w-0 wrap-break-word">
                                  Generated By:{" "}
                                  {billDetail.generatedBy?.fullName ?? "—"}
                                </span>
                              </div>

                              {billDetail.notes ? (
                                <div className="rounded-md bg-neutral-50 px-3 py-2">
                                  <div className="text-xs font-semibold text-neutral-500">
                                    Notes
                                  </div>

                                  <div className="mt-1 whitespace-pre-wrap wrap-break-word text-sm text-neutral-700">
                                    {billDetail.notes}
                                  </div>
                                </div>
                              ) : null}

                              <div className="grid gap-2 pt-2 sm:grid-cols-2">
                                <Button
                                  variant="outline"
                                  className="gap-2"
                                  type="button"
                                  onClick={handleViewBill}
                                >
                                  <FileText className="h-4 w-4" />
                                  View Bill
                                </Button>

                                <Button
                                  type="button"
                                  disabled={billDetail.outstandingAmount <= 0}
                                  onClick={handleOpenPayment}
                                >
                                  Add Payment
                                </Button>
                              </div>
                            </>
                          ) : (
                            <div className="py-4 text-sm text-neutral-500">
                              Expand the bill to load its details.
                            </div>
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>

            <div className="flex flex-col gap-3 border-t px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm text-neutral-500">
                Showing {customerBills.length ? pageIndex * PAGE_SIZE + 1 : 0}{" "}
                to{" "}
                {customerBills.length
                  ? pageIndex * PAGE_SIZE + customerBills.length
                  : 0}{" "}
                of {pageInfo?.totalItems ?? 0} bills
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
                      variant={
                        pageIndex + 1 === pageNumber ? "default" : "outline"
                      }
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
          </>
        ) : (
          <div className="flex h-32 items-center justify-center px-4 text-center text-sm text-neutral-500">
            No bills generated yet.
          </div>
        )}
      </section>

      <section className="rounded-lg border px-3 py-3 sm:px-4">
        <h3 className="font-semibold text-[#266699]">Summary</h3>

        <div className="mt-3 grid gap-2.5 grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Total Bills" value={String(summary.totalBills)} />

          <SummaryCard
            label="Total Billed"
            value={formatCurrency(summary.totalBilled)}
          />

          <SummaryCard
            label="Total Paid"
            value={formatCurrency(summary.totalPaid)}
          />

          <SummaryCard
            label="Outstanding"
            value={formatCurrency(summary.outstanding)}
            valueClassName="text-red-500"
          />
        </div>

        {isFetching ? (
          <div className="mt-3 text-xs text-neutral-500">Updating bills…</div>
        ) : null}
      </section>

      <div className="flex items-start gap-2 rounded-lg border bg-blue-50 px-3 py-3 text-sm text-neutral-600 sm:px-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#266699]" />

        <p className="min-w-0">
          Click any bill to inspect its monthly breakdown.
        </p>
      </div>
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
    <div className="flex min-w-0 flex-col items-center justify-center gap-2 rounded-lg border bg-[#F6F6F6] p-3 text-center sm:p-4">
      <span className="max-w-full truncate text-xs font-semibold text-neutral-700">
        {label}
      </span>

      <span
        className={`max-w-full truncate font-semibold ${valueClassName ?? ""}`}
      >
        {value}
      </span>
    </div>
  );
}
