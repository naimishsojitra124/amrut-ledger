import { useMemo } from "react";
import { ReceiptText, Wallet } from "lucide-react";

import { useCustomerBillsQuery } from "@/services/customer.service";
import { useModalStore } from "@/store/modal.store";

import { formatCurrency } from "@/utils/format-currency";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function OutstandingLedgerModal() {
  const activeModal = useModalStore((state) => state.activeModal);
  const customerModal = useModalStore((state) => state.customerModal);
  const closeModal = useModalStore((state) => state.closeModal);

  const isOpen = activeModal === "outstandingLedger" && Boolean(customerModal);

  const { data } = useCustomerBillsQuery(
    isOpen ? (customerModal?.customerId ?? "") : "",
    {
      page: 1,
      limit: 100,
    },
  );

  const bills = useMemo(
    () => (data?.items ?? []).filter((bill) => bill.outstandingAmount > 0),
    [data?.items],
  );

  const total = useMemo(
    () => bills.reduce((sum, bill) => sum + bill.outstandingAmount, 0),
    [bills],
  );

  if (!isOpen || !customerModal) {
    return null;
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          closeModal();
        }
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-3xl min-w-[90vw] sm:min-w-120 md:min-w-150 lg:min-w-150 flex-col gap-0 overflow-hidden p-2 sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl">
        <DialogHeader className="shrink-0 border-b px-2 py-4 pr-12 sm:px-3 sm:py-3">
          <DialogTitle className="text-base sm:text-lg">
            Outstanding Ledger
          </DialogTitle>

          <DialogDescription className="text-xs leading-5 sm:text-sm">
            Outstanding bills for{" "}
            <span className="font-medium text-neutral-900">
              {customerModal.customerName ?? "this customer"}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {bills.length > 0 ? (
            <div className="space-y-4 p-4 sm:p-6">
              {/* Total outstanding summary */}
              <div className="rounded-xl border bg-neutral-50 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-white">
                    <Wallet className="h-5 w-5 text-neutral-700" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-medium text-neutral-500 sm:text-sm">
                      Total Outstanding
                    </p>

                    <p className="mt-0.5 text-xl font-bold tracking-tight text-neutral-950 sm:text-2xl">
                      {formatCurrency(total)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Outstanding bills */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    Outstanding Bills
                  </h3>

                  <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
                    {bills.length} {bills.length === 1 ? "bill" : "bills"}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {bills.map((bill) => {
                    const billMonth = new Date(
                      bill.year,
                      bill.month - 1,
                    ).toLocaleDateString("en-IN", {
                      month: "short",
                      year: "numeric",
                    });

                    return (
                      <div
                        key={bill.id}
                        className="rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100">
                              <ReceiptText className="h-4 w-4 text-neutral-600" />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-neutral-900">
                                {bill.billNumber}
                              </p>

                              <p className="mt-0.5 text-xs text-neutral-500">
                                {billMonth}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                              Due
                            </p>

                            <p className="mt-0.5 text-base font-bold text-neutral-950">
                              {formatCurrency(bill.outstandingAmount)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-3">
                          <div className="min-w-0">
                            <p className="text-xs text-neutral-500">
                              Bill Total
                            </p>

                            <p className="mt-0.5 truncate text-sm font-medium text-neutral-800">
                              {formatCurrency(bill.grandTotal)}
                            </p>
                          </div>

                          <div className="min-w-0 text-right">
                            <p className="text-xs text-neutral-500">Paid</p>

                            <p className="mt-0.5 truncate text-sm font-medium text-neutral-800">
                              {formatCurrency(bill.totalPaid)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center px-6 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
                <Wallet className="h-5 w-5 text-neutral-500" />
              </div>

              <p className="mt-3 text-sm font-medium text-neutral-700">
                No outstanding bills
              </p>

              <p className="mt-1 max-w-sm text-xs leading-5 text-neutral-500 sm:text-sm">
                This customer currently has no unpaid bill balance.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-6 sm:py-4">
          <Button
            type="button"
            onClick={closeModal}
            className="w-full sm:w-auto"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
