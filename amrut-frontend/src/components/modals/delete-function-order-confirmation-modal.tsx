import { Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useModalStore } from "@/store/modal.store";

import { useDeleteFunctionOrderMutation } from "@/services/function-order.service";

export default function DeleteFunctionOrderConfirmationModal() {
  const activeModal = useModalStore((state) => state.activeModal);

  const payload = useModalStore((state) => state.functionOrderDeleteConfirm);

  const closeModal = useModalStore((state) => state.closeModal);

  const deleteMutation = useDeleteFunctionOrderMutation();

  const isOpen =
    activeModal === "functionOrderDeleteConfirm" && Boolean(payload);

  if (!isOpen || !payload) {
    return null;
  }

  async function handleConfirm() {
    try {
      await deleteMutation.mutateAsync(payload!.orderId);

      toast.success("Function order deleted");

      payload!.onConfirmed?.();

      closeModal();
    } catch {
      // Already reported by the global error handler.
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !deleteMutation.isPending) {
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
                Delete Function Order
              </DialogTitle>

              <DialogDescription className="mt-1 text-xs leading-5 sm:text-sm">
                Are you sure you want to delete{" "}
                <span className="font-medium text-neutral-900">
                  {payload.orderNumber}
                </span>
                ?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6">
          <div className="rounded-xl border bg-neutral-50 p-4">
            <p className="text-sm leading-6 text-neutral-600">
              This action permanently removes the function order and its
              associated order data.
            </p>
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-6 sm:py-4">
          <Button
            type="button"
            variant="outline"
            onClick={closeModal}
            disabled={deleteMutation.isPending}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={deleteMutation.isPending}
            className="w-full sm:w-auto"
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Order"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
