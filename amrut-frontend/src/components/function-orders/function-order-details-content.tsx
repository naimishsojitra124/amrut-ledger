import { useCallback, useEffect, useState } from "react";

import { FileDown, Trash2 } from "lucide-react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import FunctionOrderEditor from "./function-order-editor";
import FunctionOrderAuditLog from "./function-order-audit-log";

import {
  useFunctionOrderAuditLogsQuery,
  useUpdateFunctionOrderMutation,
} from "@/services/function-order.service";

import type {
  FunctionOrderInput,
  FunctionOrderListItemsResponse,
} from "@/types/function-order";

import { isValidFunctionOrder } from "@/utils/function-order";

import { generateFunctionOrderPdf } from "@/utils/generate-function-order-pdf";

import { useModalStore } from "@/store/modal.store";

type FunctionOrderDetailsContentProps = {
  order: FunctionOrderListItemsResponse | null;
  onDeleted?: () => void;
};

export default function FunctionOrderDetailsContent({
  order,
  onDeleted,
}: FunctionOrderDetailsContentProps) {
  const [editing, setEditing] = useState<FunctionOrderListItemsResponse | null>(
    order,
  );

  const update = useUpdateFunctionOrderMutation();

  const openFunctionOrderDeleteConfirm = useModalStore(
    (state) => state.openFunctionOrderDeleteConfirm,
  );

  const auditLogs = useFunctionOrderAuditLogsQuery(editing?.id ?? null);

  useEffect(() => {
    setEditing(order);
  }, [order]);

  const saveEdit = useCallback(async () => {
    if (!editing || !isValidFunctionOrder(editing)) {
      toast.error("Check the order details and quantities.");

      return;
    }

    const input: FunctionOrderInput = {
      customerName: editing.customerName,

      mobileNumber: editing.mobileNumber,

      eventName: editing.eventName,

      deliveryDays: editing.deliveryDays,

      reminderDaysBefore: editing.reminderDaysBefore,

      status: editing.status,

      notes: editing.notes,
    };

    try {
      await update.mutateAsync({
        id: editing.id,
        input,
      });

      toast.success("Function order updated");
    } catch {
      toast.error("Unable to update function order. Please try again.");
    }
  }, [editing, update]);

  function deleteOrder() {
    if (!editing) {
      return;
    }

    openFunctionOrderDeleteConfirm({
      orderId: editing.id,
      orderNumber: editing.orderNumber,
      onConfirmed: onDeleted,
    });
  }

  if (!editing) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-slate-500">
        Select a function order to view its details.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b px-4 py-4 text-left sm:px-6 sm:py-5">
        <div className="truncate font-semibold text-slate-900">
          {editing.orderNumber}
          {" — "}
          order details
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6">
        <FunctionOrderEditor
          value={editing}
          onChange={(nextValue) => {
            setEditing((current) => {
              if (!current) {
                return current;
              }

              if (typeof nextValue === "function") {
                return {
                  ...current,
                  ...nextValue(current),
                };
              }

              return {
                ...current,
                ...nextValue,
              };
            });
          }}
          showMovements
        />

        <div className="mt-5 flex flex-col gap-3 border-t pt-4">
          <Button
            type="button"
            onClick={() => void saveEdit()}
            disabled={update.isPending}
          >
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => generateFunctionOrderPdf(editing)}
              disabled={update.isPending}
            >
              <FileDown className="mr-1 h-4 w-4" />
              PDF
            </Button>

            <Button
              type="button"
              variant="destructive"
              disabled={update.isPending}
              onClick={deleteOrder}
              className="w-full sm:w-auto"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        <FunctionOrderAuditLog
          logs={auditLogs.data?.items ?? []}
          isLoading={auditLogs.isPending}
        />
      </div>
    </div>
  );
}
