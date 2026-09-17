import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useModalStore } from "@/store/modal.store";

export default function ConfirmationDialog() {
  const { activeModal, confirmation, closeModal } = useModalStore();
  const [isPending, setIsPending] = useState(false);

  const isOpen = activeModal === "confirmation" && Boolean(confirmation);

  async function handleConfirm() {
    if (!confirmation || isPending) return;

    setIsPending(true);
    try {
      await confirmation.onConfirm();
      if (confirmation.successMessage) {
        toast.success(confirmation.successMessage);
      }
      closeModal();
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "The action could not be completed.",
      );
    } finally {
      setIsPending(false);
    }
  }

  if (!confirmation) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isPending) closeModal();
      }}
    >
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle>{confirmation.title}</DialogTitle>
          {confirmation.description ? (
            <DialogDescription className="leading-5">
              {confirmation.description}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={closeModal}
            disabled={isPending}
          >
            {confirmation.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            type="button"
            variant={confirmation.variant === "destructive" ? "destructive" : "default"}
            onClick={() => void handleConfirm()}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              confirmation.confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
