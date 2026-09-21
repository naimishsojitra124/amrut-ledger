import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  useBillQuery,
  useRecordPaymentMutation,
} from "@/services/bill.service";
import { useCustomerQuery } from "@/services/customer.service";
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
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";

export function PaymentModal() {
  const activeModal = useModalStore((state) => state.activeModal);
  const payment = useModalStore((state) => state.payment);
  const closeModal = useModalStore((state) => state.closeModal);

  const isOpen = activeModal === "payment" && Boolean(payment);

  const bill = useBillQuery(isOpen ? (payment?.billId ?? null) : null).data;

  const customer = useCustomerQuery(
    isOpen ? (payment?.customerId ?? null) : null,
  ).data;

  const recordPayment = useRecordPaymentMutation();

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "upi">("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [useDeposit, setUseDeposit] = useState(false);

  useEffect(() => {
    if (!isOpen || !bill) {
      return;
    }

    setAmount(String(bill.outstandingAmount));
    setMethod("cash");
    setReferenceNumber("");
    setNotes("");
    setUseDeposit(false);
  }, [isOpen, bill?.id]);

  if (!isOpen || !payment) {
    return null;
  }

  const availableDeposit = customer?.depositAmount ?? 0;

  const depositCredit =
    useDeposit && bill ? Math.min(availableDeposit, bill.outstandingAmount) : 0;

  const maxAmount = Math.max(0, (bill?.outstandingAmount ?? 0) - depositCredit);

  const numericAmount = Number(amount);

  const isInvalidAmount =
    !Number.isFinite(numericAmount) ||
    numericAmount < 0 ||
    numericAmount > maxAmount;

  const isSubmitDisabled =
    !bill ||
    recordPayment.isPending ||
    isInvalidAmount ||
    (numericAmount === 0 && depositCredit === 0);

  function handleDepositToggle(checked: boolean) {
    setUseDeposit(checked);

    if (!bill) {
      return;
    }

    const credit = checked
      ? Math.min(availableDeposit, bill.outstandingAmount)
      : 0;

    setAmount(String(Math.max(0, bill.outstandingAmount - credit)));
  }

  function handleSubmit() {
    if (!bill || isSubmitDisabled) {
      return;
    }

    recordPayment.mutate(
      {
        billId: bill.id,
        amount: numericAmount,
        useDeposit,
        paymentMethod: method,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: closeModal,
      },
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !recordPayment.isPending) {
          closeModal();
        }
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-3xl min-w-[90vw] sm:min-w-120 md:min-w-150 lg:min-w-150 flex-col gap-0 overflow-hidden p-2 sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl">
        <DialogHeader className="shrink-0 border-b px-2 py-4 pr-12 sm:px-3 sm:py-3">
          <DialogTitle className="text-base sm:text-lg">
            Add Payment
          </DialogTitle>

          <DialogDescription className="text-xs leading-5 sm:text-sm">
            Record a payment against{" "}
            <span className="font-medium text-neutral-900">
              {bill?.billNumber ?? "this bill"}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-4 px-2 py-5 sm:px-3">
            {bill ? (
              <>
                <div className="rounded-lg bg-neutral-50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-neutral-600">Outstanding</span>

                    <span className="font-semibold text-neutral-900">
                      {formatCurrency(bill.outstandingAmount)}
                    </span>
                  </div>
                </div>

                {availableDeposit > 0 && (
                  <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border p-3 text-sm">
                    <span className="min-w-0">
                      <span className="block font-medium text-neutral-900">
                        Use deposit balance
                      </span>

                      <span className="mt-0.5 block text-xs text-neutral-500">
                        Available: {formatCurrency(availableDeposit)}
                      </span>
                    </span>

                    <input
                      type="checkbox"
                      checked={useDeposit}
                      onChange={(event) =>
                        handleDepositToggle(event.target.checked)
                      }
                      disabled={recordPayment.isPending}
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />
                  </label>
                )}

                {useDeposit && (
                  <div className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                    Deposit credit:{" "}
                    <span className="font-medium text-neutral-900">
                      {formatCurrency(depositCredit)}
                    </span>{" "}
                    · Remaining deposit:{" "}
                    <span className="font-medium text-neutral-900">
                      {formatCurrency(availableDeposit - depositCredit)}
                    </span>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="payment-amount"
                    className="text-sm font-medium"
                  >
                    Cash / UPI Amount
                  </label>

                  <input
                    id="payment-amount"
                    type="number"
                    min="0"
                    max={maxAmount}
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    disabled={recordPayment.isPending}
                    className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#266699]"
                    inputMode="decimal"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="payment-method"
                    className="text-sm font-medium"
                  >
                    Payment Method
                  </label>

                  <Select
                    value={method}
                    onValueChange={(value) =>
                      setMethod(value as "cash" | "upi")
                    }
                    disabled={recordPayment.isPending}
                  >
                    <SelectTrigger className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#266699]">
                      <span className="text-sm text-neutral-900">
                        {method === "cash" ? "Cash" : "UPI"}
                      </span>
                    </SelectTrigger>

                    <SelectContent position="popper">
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {method === "upi" && (
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="payment-reference"
                      className="text-sm font-medium"
                    >
                      Reference Number
                    </label>

                    <input
                      id="payment-reference"
                      value={referenceNumber}
                      onChange={(event) =>
                        setReferenceNumber(event.target.value)
                      }
                      disabled={recordPayment.isPending}
                      className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#266699]"
                      autoComplete="off"
                    />
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="payment-notes"
                    className="text-sm font-medium"
                  >
                    Notes
                  </label>

                  <textarea
                    id="payment-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    disabled={recordPayment.isPending}
                    className="min-h-16 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#266699]"
                  />
                </div>
              </>
            ) : (
              <div className="flex min-h-32 items-center justify-center text-sm text-neutral-500">
                Loading payment details...
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-6 sm:py-4">
          <Button
            type="button"
            variant="outline"
            onClick={closeModal}
            disabled={recordPayment.isPending}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>

          <Button
            type="button"
            disabled={isSubmitDisabled}
            onClick={handleSubmit}
            className="w-full sm:w-auto"
          >
            {recordPayment.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
