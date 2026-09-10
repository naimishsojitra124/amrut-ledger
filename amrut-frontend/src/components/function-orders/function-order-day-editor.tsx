import { memo, useCallback } from "react";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import FunctionOrderNumberInput from "./function-order-number-input";
import FunctionOrderItemEditor from "./function-order-item-editor";

import type {
  FunctionOrderDay,
  FunctionOrderItem,
} from "@/types/function-order";

import { DateTimePicker } from "../common/date-time-picker";

interface FunctionOrderDayEditorProps {
  day: FunctionOrderDay;
  index: number;
  showMovements: boolean;
  canRemove: boolean;

  onChangeDay: (
    index: number,
    updater: FunctionOrderDay | ((day: FunctionOrderDay) => FunctionOrderDay),
  ) => void;

  onRemoveDay: (index: number) => void;
}

function FunctionOrderDayEditor({
  day,
  index,
  showMovements,
  canRemove,
  onChangeDay,
  onRemoveDay,
}: FunctionOrderDayEditorProps) {
  const changeDay = useCallback(
    (
      updater: FunctionOrderDay | ((day: FunctionOrderDay) => FunctionOrderDay),
    ) => {
      onChangeDay(index, updater);
    },
    [index, onChangeDay],
  );

  const handleDateChange = useCallback(
    (deliveryDate: string) => {
      changeDay((current) => ({
        ...current,
        deliveryDate,
      }));
    },
    [changeDay],
  );

  const handleTimeChange = useCallback(
    (deliveryTime: string) => {
      changeDay((current) => ({
        ...current,
        deliveryTime,
      }));
    },
    [changeDay],
  );

  const handlePeopleCountChange = useCallback(
    (peopleCount: number) => {
      changeDay((current) => ({
        ...current,
        peopleCount,
      }));
    },
    [changeDay],
  );

  const handleRemoveDay = useCallback(() => {
    onRemoveDay(index);
  }, [index, onRemoveDay]);

  const handleChangeItem = useCallback(
    (itemId: string, patch: Partial<FunctionOrderItem>) => {
      changeDay((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                ...patch,
              }
            : item,
        ),
      }));
    },
    [changeDay],
  );

  const handleRemoveItem = useCallback(
    (itemId: string) => {
      changeDay((current) => ({
        ...current,
        items: current.items.filter((item) => item.id !== itemId),
      }));
    },
    [changeDay],
  );

  const handleAddItem = useCallback(() => {
    changeDay((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: crypto.randomUUID(),
          itemName: "",
          quantity: 1,
          unit: "kg",
          unitPrice: 0,
          returnedQuantity: 0,
          returnNote: "",
          movements: [],
        },
      ],
    }));
  }, [changeDay]);

  return (
    <section className="rounded-xl border bg-white p-3 sm:p-4">
      <div className="mb-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <DateTimePicker
            dateLabel="Delivery date"
            timeLabel="Delivery time"
            dateValue={day.deliveryDate}
            dateOnChange={handleDateChange}
            timeValue={day.deliveryTime}
            timeOnChange={handleTimeChange}
            dateClassName="w-full"
          />

          <label className="mt-3 grid gap-1 text-xs font-medium text-slate-600 sm:max-w-xs">
            People count
            <FunctionOrderNumberInput
              value={day.peopleCount}
              min={0}
              step={1}
              decimalPlaces={0}
              onChange={handlePeopleCountChange}
            />
          </label>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!canRemove}
          onClick={handleRemoveDay}
          aria-label="Remove delivery day"
          className="justify-self-end"
        >
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>

      <div className="space-y-3">
        {day.items.map((item) => (
          <FunctionOrderItemEditor
            key={item.id}
            item={item}
            showMovements={showMovements}
            canRemove={day.items.length > 1}
            onChangeItem={handleChangeItem}
            onRemoveItem={handleRemoveItem}
          />
        ))}
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleAddItem}
        className="mt-3 w-full sm:w-auto"
      >
        <span className="mr-1 text-base leading-none">+</span>
        Item
      </Button>
    </section>
  );
}

export default memo(FunctionOrderDayEditor);
