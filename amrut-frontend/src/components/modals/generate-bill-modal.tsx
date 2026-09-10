import { useState } from "react";
import { Loader2 } from "lucide-react";

import { useGenerateBillMutation } from "@/services/bill.service";
import { useModalStore } from "@/store/modal.store";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

export function GenerateBillModal() {
  const activeModal = useModalStore((state) => state.activeModal);
  const customerModal = useModalStore((state) => state.customerModal);
  const closeModal = useModalStore((state) => state.closeModal);

  const now = new Date();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const mutation = useGenerateBillMutation();

  const isOpen = activeModal === "generateBill" && Boolean(customerModal);

  if (!isOpen || !customerModal) {
    return null;
  }

  function handleGenerate() {
    if (!customerModal) {
      return;
    }

    mutation.mutate(
      {
        customerId: customerModal.customerId,
        month,
        year,
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
        if (!open && !mutation.isPending) {
          closeModal();
        }
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-lg flex-col gap-0 overflow-hidden p-2 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100%-2rem)] sm:rounded-2xl">
        <DialogHeader className="shrink-0 border-b px-2 py-4 pr-12 sm:px-3 sm:py-3">
          <DialogTitle className="text-base sm:text-lg">
            Generate Bill
          </DialogTitle>

          <DialogDescription className="text-xs leading-5 sm:text-sm">
            Generate a bill for{" "}
            <span className="font-medium text-neutral-900">
              {customerModal.customerName ?? "this customer"}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-6">
          <label className="space-y-1.5 text-sm font-medium">
            <span>Month</span>

            <Select
              value={month.toString()}
              onValueChange={(value) => setMonth(Number(value))}
              disabled={mutation.isPending}
            >
              <SelectTrigger className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#266699]">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>

              <SelectContent position="popper">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <SelectItem key={m} value={m.toString()}>
                    {new Date(0, m - 1).toLocaleString("en-IN", {
                      month: "long",
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="space-y-1.5 text-sm font-medium">
            <span>Year</span>

            <input
              type="number"
              min="2000"
              max="2100"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              disabled={mutation.isPending}
              className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#266699]"
            />
          </label>
        </div>

        <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-6 sm:py-4">
          <Button
            type="button"
            variant="outline"
            onClick={closeModal}
            disabled={mutation.isPending}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>

          <Button
            type="button"
            disabled={mutation.isPending}
            onClick={handleGenerate}
            className="w-full sm:w-auto"
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Generate Bill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
