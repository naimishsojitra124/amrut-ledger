import { memo, useCallback, type ChangeEvent } from "react";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import FunctionOrderNumberInput from "./function-order-number-input";
import FunctionOrderMovementEditor from "./function-order-movement-editor";

import type {
  FunctionOrderItem,
  FunctionOrderItemMovement,
} from "@/types/function-order";

interface FunctionOrderItemEditorProps {
  item: FunctionOrderItem;
  showMovements: boolean;
  canRemove: boolean;

  onChangeItem: (itemId: string, patch: Partial<FunctionOrderItem>) => void;

  onRemoveItem: (itemId: string) => void;
}

function FunctionOrderItemEditor({
  item,
  showMovements,
  canRemove,
  onChangeItem,
  onRemoveItem,
}: FunctionOrderItemEditorProps) {
  const updateItem = useCallback(
    (patch: Partial<FunctionOrderItem>) => {
      onChangeItem(item.id, patch);
    },
    [item.id, onChangeItem],
  );

  const handleItemNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateItem({
        itemName: event.target.value,
      });
    },
    [updateItem],
  );

  const handleQuantityChange = useCallback(
    (quantity: number) => {
      updateItem({ quantity });
    },
    [updateItem],
  );

  const handleUnitChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateItem({
        unit: event.target.value,
      });
    },
    [updateItem],
  );

  const handleUnitPriceChange = useCallback(
    (unitPrice: number) => {
      updateItem({ unitPrice });
    },
    [updateItem],
  );

  const handleRemoveItem = useCallback(() => {
    onRemoveItem(item.id);
  }, [item.id, onRemoveItem]);

  const handleMovementChange = useCallback(
    (movementId: string, patch: Partial<FunctionOrderItemMovement>) => {
      updateItem({
        movements: item.movements.map((movement) =>
          movement.id === movementId
            ? {
                ...movement,
                ...patch,
              }
            : movement,
        ),
      });
    },
    [item.movements, updateItem],
  );

  const handleMovementRemove = useCallback(
    (movementId: string) => {
      updateItem({
        movements: item.movements.filter(
          (movement) => movement.id !== movementId,
        ),
      });
    },
    [item.movements, updateItem],
  );

  const addMovement = useCallback(
    (type: "dispatch" | "return") => {
      updateItem({
        movements: [
          ...item.movements,
          {
            id: crypto.randomUUID(),
            type,
            quantity: 1,
            note: "",
            createdAt: new Date().toISOString(),
          },
        ],
      });
    },
    [item.movements, updateItem],
  );

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-[minmax(0,1fr)_110px_90px_125px_40px] md:items-end">
        <label className="col-span-2 grid gap-1 text-xs font-medium text-slate-600 sm:col-span-4 md:col-span-1">
          Item
          <Input
            value={item.itemName}
            onChange={handleItemNameChange}
            placeholder="Item"
          />
        </label>

        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Quantity
          <FunctionOrderNumberInput
            value={item.quantity}
            min={0.01}
            step={0.01}
            decimalPlaces={2}
            placeholder="Qty"
            onChange={handleQuantityChange}
          />
        </label>

        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Unit
          <Input
            value={item.unit}
            onChange={handleUnitChange}
            placeholder="Unit"
          />
        </label>

        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Unit price
          <FunctionOrderNumberInput
            value={item.unitPrice}
            min={0}
            step={1}
            decimalPlaces={0}
            placeholder="Rate"
            onChange={handleUnitPriceChange}
          />
        </label>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!canRemove}
          onClick={handleRemoveItem}
          aria-label={`Remove ${item.itemName || "item"}`}
          className="col-span-2 justify-self-end sm:col-span-4 md:col-span-1"
        >
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>

      {showMovements ? (
        <div className="mt-3 rounded-lg bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold text-slate-600">
            Additional dispatches and returns
          </p>

          {item.movements.map((movement) => (
            <FunctionOrderMovementEditor
              key={movement.id}
              movement={movement}
              itemUnit={item.unit}
              onChange={handleMovementChange}
              onRemove={handleMovementRemove}
            />
          ))}

          <div className="grid gap-2 sm:flex">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addMovement("dispatch")}
              className="w-full sm:w-auto"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add dispatch
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addMovement("return")}
              className="w-full sm:w-auto"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add return
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default memo(FunctionOrderItemEditor);
