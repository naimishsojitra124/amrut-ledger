import { memo, useCallback, type ChangeEvent } from "react";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import FunctionOrderNumberInput from "./function-order-number-input";

import type { FunctionOrderItemMovement } from "@/types/function-order";

interface FunctionOrderMovementEditorProps {
  movement: FunctionOrderItemMovement;
  itemUnit: string;

  onChange: (
    movementId: string,
    patch: Partial<FunctionOrderItemMovement>,
  ) => void;

  onRemove: (movementId: string) => void;
}

function FunctionOrderMovementEditor({
  movement,
  itemUnit,
  onChange,
  onRemove,
}: FunctionOrderMovementEditorProps) {
  const handleQuantityChange = useCallback(
    (quantity: number) => {
      onChange(movement.id, {
        quantity,
      });
    },
    [movement.id, onChange],
  );

  const handleNoteChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(movement.id, {
        note: event.target.value,
      });
    },
    [movement.id, onChange],
  );

  const handleRemove = useCallback(() => {
    onRemove(movement.id);
  }, [movement.id, onRemove]);

  return (
    <div className="mb-2 grid gap-2 sm:grid-cols-[110px_100px_minmax(0,1fr)_32px]">
      <span className="rounded-md border bg-white px-3 py-2 text-sm capitalize">
        {movement.type}
      </span>

      <FunctionOrderNumberInput
        value={movement.quantity}
        min={0.01}
        step={0.01}
        decimalPlaces={2}
        placeholder="Qty"
        onChange={handleQuantityChange}
      />

      <Input
        value={movement.note}
        placeholder={`Note (${itemUnit})`}
        onChange={handleNoteChange}
      />

      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={handleRemove}
        aria-label={`Remove ${movement.type}`}
      >
        <Trash2 className="h-4 w-4 text-red-500" />
      </Button>
    </div>
  );
}

export default memo(FunctionOrderMovementEditor);
