import { useModalStore } from "@/store/modal.store";

import { useArchiveCustomerMutation } from "@/services/customer.service";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

import { Loader2, TriangleAlert } from "lucide-react";

import { formatCurrency } from "@/utils/format-currency";

export default function CloseCustomerConfirmModal() {
  const activeModal = useModalStore((state) => state.activeModal);

  const payload = useModalStore((state) => state.customerCloseConfirm);

  const closeModal = useModalStore((state) => state.closeModal);

  const archiveCustomerMutation = useArchiveCustomerMutation();

  const isOpen = activeModal === "customerCloseConfirm" && Boolean(payload);

  if (!isOpen || !payload) {
    return null;
  }

  const depositAmount = Number(payload.depositAmount) || 0;

  async function handleConfirm() {
    try {
      await archiveCustomerMutation.mutateAsync({
        id: payload!.customerId,
        refundDeposit: true,
      });

      payload!.onConfirmed?.();

      closeModal();
    } catch {
      // Mutation errors are handled by
      // the existing customer mutation layer.
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !archiveCustomerMutation.isPending) {
          closeModal();
        }
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-3xl min-w-[90vw] sm:min-w-120 md:min-w-150 lg:min-w-150 flex-col gap-0 overflow-hidden p-2 sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl">
        <DialogHeader className="shrink-0 border-b px-2 py-4 pr-12 sm:px-3 sm:py-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <TriangleAlert className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg">
                Close Customer
              </DialogTitle>

              <DialogDescription className="mt-1 text-xs leading-5 sm:text-sm">
                This action will close{" "}
                <span className="font-medium text-neutral-900">
                  {payload.customerName}
                </span>{" "}
                and refund the customer&apos;s deposit.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-4 py-5 sm:px-6 sm:py-6">
          <div className="rounded-xl border border-red-100 bg-red-50/60 p-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-neutral-600">
                Deposit to refund
              </span>

              <span className="whitespace-nowrap text-base font-semibold text-red-600">
                {formatCurrency(depositAmount)}
              </span>
            </div>

            <p className="mt-2 text-xs leading-5 text-neutral-500">
              The customer will be marked as closed after the refund is
              successfully processed.
            </p>
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-6 sm:py-4">
          <Button
            type="button"
            variant="outline"
            onClick={closeModal}
            disabled={archiveCustomerMutation.isPending}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={archiveCustomerMutation.isPending}
            className="w-full sm:w-auto"
          >
            {archiveCustomerMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Closing...
              </>
            ) : (
              "Refund & Close"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
