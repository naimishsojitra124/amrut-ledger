import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import FunctionOrderEditor from "./function-order-editor";

import { Button } from "@/components/ui/button";

import { useCreateFunctionOrderMutation } from "@/services/function-order.service";

import {
  createEmptyFunctionOrder,
  isValidFunctionOrder,
} from "@/utils/function-order";

export default function NewFunctionOrderForm() {
  const [draft, setDraft] = useState(createEmptyFunctionOrder);

  const create = useCreateFunctionOrderMutation();

  const createOrder = useCallback(async () => {
    if (!isValidFunctionOrder(draft)) {
      toast.error("Add customer details, delivery dates, and valid items.");
      return;
    }

    try {
      await create.mutateAsync(draft);

      setDraft(createEmptyFunctionOrder());

      toast.success("Function order created");
    } catch {
      // Already surfaced by the global error handler.
    }
  }, [create, draft]);

  return (
    <section className="rounded-2xl border bg-white p-3 shadow-sm sm:p-5">
      <h2 className="text-base font-semibold sm:text-lg">New Function Order</h2>

      <FunctionOrderEditor
        value={draft}
        onChange={setDraft}
        showMovements={false}
      />

      <Button
        type="button"
        className="mt-4 w-full sm:w-auto"
        onClick={() => void createOrder()}
        disabled={create.isPending}
      >
        <Plus className="mr-1 h-4 w-4" />

        {create.isPending ? "Saving…" : "Create Function Order"}
      </Button>
    </section>
  );
}
