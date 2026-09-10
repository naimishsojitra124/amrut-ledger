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
  useCreateProductSuggestionMutation,
  useProductSuggestionsQuery,
  useUpdateProductSuggestionMutation,
} from "@/services/product-suggestion.service";

export function ProductSuggestionFormModal() {
  const activeModal = useModalStore((state) => state.activeModal);
  const settingsForm = useModalStore((state) => state.settingsForm);
  const closeModal = useModalStore((state) => state.closeModal);

  const id = settingsForm?.id ?? null;
  const isOpen = activeModal === "productSuggestionForm";

  const item = useProductSuggestionsQuery({
    page: 1,
    limit: 100,
  }).data?.items.find((product) => product.id === id);

  const create = useCreateProductSuggestionMutation();

  const update = useUpdateProductSuggestionMutation();

  const [name, setName] = useState("");
  const [order, setOrder] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setName(item?.name ?? "");
    setOrder(item ? String(item.displayOrder + 1) : "");
  }, [isOpen, item, id]);

  if (!isOpen) {
    return null;
  }

  const isSaving = create.isPending || update.isPending;

  async function save() {
    const displayOrder = order.trim() ? Number(order) - 1 : undefined;

    if (
      !name.trim() ||
      (displayOrder !== undefined &&
        (!Number.isInteger(displayOrder) || displayOrder < 0))
    ) {
      return;
    }

    if (id) {
      await update.mutateAsync({
        id,
        payload: {
          name: name.trim(),
          displayOrder,
        },
      });
    } else {
      await create.mutateAsync({
        name: name.trim(),
        displayOrder,
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
            {id ? "Edit Product Suggestion" : "Add Product Suggestion"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 px-1 py-3 sm:px-4 sm:py-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="product-suggestion-name"
              className="text-sm font-medium"
            >
              Product Name
            </label>

            <Input
              id="product-suggestion-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Product name"
              disabled={isSaving}
              className="h-11"
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="product-suggestion-order"
              className="text-sm font-medium"
            >
              Display Order
            </label>

            <Input
              id="product-suggestion-order"
              value={order}
              onChange={(event) => setOrder(event.target.value)}
              type="number"
              min="1"
              step="1"
              placeholder="Display order (optional)"
              disabled={isSaving}
              className="h-11"
              inputMode="numeric"
            />

            <p className="text-xs leading-5 text-neutral-500">
              Leave blank to let the system determine the order.
            </p>
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-6 sm:py-4">
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
            {id ? "Save changes" : "Add product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
