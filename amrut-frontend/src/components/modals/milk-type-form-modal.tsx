import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { useModalStore } from "@/store/modal.store";

import {
  useCreateMilkTypeMutation,
  useMilkTypeQuery,
  useUpdateMilkTypeMutation,
} from "@/hooks/use-milk-types";

export function MilkTypeFormModal() {
  const activeModal = useModalStore((state) => state.activeModal);
  const settingsForm = useModalStore((state) => state.settingsForm);
  const closeModal = useModalStore((state) => state.closeModal);

  const id = settingsForm?.id ?? null;
  const isOpen = activeModal === "milkTypeForm";

  // Only load when this modal is the one on screen. `settingsForm.id` is
  // shared by every settings modal, so an id belonging to another entity would
  // otherwise be fetched as a milk type.
  const item = useMilkTypeQuery(isOpen ? (id ?? undefined) : undefined).data;

  const create = useCreateMilkTypeMutation();
  const update = useUpdateMilkTypeMutation();

  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [rate, setRate] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setName(item?.name ?? "");
    setShortCode(item?.shortCode ?? "");
    setRate(item ? String(item.rate) : "");
  }, [isOpen, item, id]);

  if (!isOpen) {
    return null;
  }

  const isSaving = create.isPending || update.isPending;

  async function save() {
    const amount = Number(rate);

    if (!name.trim() || !shortCode.trim() || !Number.isFinite(amount)) {
      return;
    }

    if (id && item) {
      await update.mutateAsync({
        id,
        data: {
          name: name.trim(),
          shortCode: shortCode.trim().toUpperCase(),
          rate: amount,
          displayOrder: item.displayOrder,
          status: item.status,
        },
      });
    } else {
      await create.mutateAsync({
        name: name.trim(),
        shortCode: shortCode.trim().toUpperCase(),
        rate: amount,
      });
    }

    closeModal();
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isSaving) {
          closeModal();
        }
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-lg flex-col gap-0 overflow-hidden p-2 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100%-2rem)] sm:rounded-2xl">
        <DialogHeader className="shrink-0 border-b px-2 py-4 pr-12 sm:px-3 sm:py-3">
          <DialogTitle className="text-base sm:text-lg">
            {id ? "Edit Milk Type" : "Add Milk Type"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 px-2 py-5 sm:px-6">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="milk-type-name" className="text-sm font-medium">
              Milk Type Name
            </label>

            <Input
              id="milk-type-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Milk type name"
              disabled={isSaving}
              className="h-11"
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="milk-type-short-code"
              className="text-sm font-medium"
            >
              Short Code
            </label>

            <Input
              id="milk-type-short-code"
              value={shortCode}
              onChange={(event) => setShortCode(event.target.value)}
              placeholder="Short code"
              disabled={isSaving}
              className="h-11"
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="milk-type-rate" className="text-sm font-medium">
              Rate per Litre
            </label>

            <Input
              id="milk-type-rate"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="Rate per litre"
              disabled={isSaving}
              className="h-11"
              inputMode="decimal"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-6 sm:py-4">
          <Button
            type="button"
            variant="outline"
            onClick={closeModal}
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={() => void save()}
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            {id ? "Save changes" : "Add milk type"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
