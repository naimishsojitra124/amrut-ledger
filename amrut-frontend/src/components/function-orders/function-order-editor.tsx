import { memo, useCallback } from "react";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import FunctionOrderNumberInput from "./function-order-number-input";
import FunctionOrderDayEditor from "./function-order-day-editor";

import type {
  FunctionOrderDay,
  FunctionOrderInput,
  FunctionOrderStatus,
} from "@/types/function-order";

import { createFunctionOrderDay } from "@/utils/function-order";

export type FunctionOrderEditorChange =
  | FunctionOrderInput
  | ((current: FunctionOrderInput) => FunctionOrderInput);

interface FunctionOrderEditorProps {
  value: FunctionOrderInput;
  onChange: (value: FunctionOrderEditorChange) => void;
  showMovements?: boolean;
}

const STATUS_OPTIONS: Array<{
  value: FunctionOrderStatus;
  label: string;
}> = [
  {
    value: "draft",
    label: "Draft",
  },
  {
    value: "confirmed",
    label: "Confirmed",
  },
  {
    value: "completed",
    label: "Completed",
  },
  {
    value: "cancelled",
    label: "Cancelled",
  },
];

function FunctionOrderEditor({
  value,
  onChange,
  showMovements = false,
}: FunctionOrderEditorProps) {
  const updateField = useCallback(
    <K extends keyof FunctionOrderInput>(
      field: K,
      fieldValue: FunctionOrderInput[K],
    ) => {
      onChange((current) => ({
        ...current,
        [field]: fieldValue,
      }));
    },
    [onChange],
  );

  const updateDay = useCallback(
    (
      index: number,
      updater: FunctionOrderDay | ((day: FunctionOrderDay) => FunctionOrderDay),
    ) => {
      onChange((current) => ({
        ...current,
        deliveryDays: current.deliveryDays.map((day, currentIndex) => {
          if (currentIndex !== index) {
            return day;
          }

          return typeof updater === "function" ? updater(day) : updater;
        }),
      }));
    },
    [onChange],
  );

  const removeDay = useCallback(
    (index: number) => {
      onChange((current) => ({
        ...current,
        deliveryDays: current.deliveryDays.filter(
          (_, currentIndex) => currentIndex !== index,
        ),
      }));
    },
    [onChange],
  );

  const addDay = useCallback(() => {
    onChange((current) => ({
      ...current,
      deliveryDays: [...current.deliveryDays, createFunctionOrderDay()],
    }));
  }, [onChange]);

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Customer name
          <Input
            value={value.customerName}
            onChange={(event) =>
              updateField("customerName", event.target.value)
            }
            placeholder="Customer name"
            autoComplete="name"
          />
        </label>

        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Mobile number
          <Input
            value={value.mobileNumber}
            onChange={(event) =>
              updateField("mobileNumber", event.target.value)
            }
            placeholder="Mobile number"
            inputMode="tel"
            autoComplete="tel"
          />
        </label>

        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Function / event name
          <Input
            value={value.eventName}
            onChange={(event) => updateField("eventName", event.target.value)}
            placeholder="Function / event name"
          />
        </label>

        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Reminder days before
          <FunctionOrderNumberInput
            value={value.reminderDaysBefore}
            min={0}
            max={14}
            step={1}
            decimalPlaces={0}
            onChange={(nextValue) =>
              updateField("reminderDaysBefore", nextValue)
            }
          />
        </label>

        <label className="grid gap-1 text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-1">
          Order status
          <Select
            value={value.status}
            onValueChange={(status) =>
              updateField("status", status as FunctionOrderStatus)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>

            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      <div className="space-y-3">
        {value.deliveryDays.map((day, index) => (
          <FunctionOrderDayEditor
            key={`${day.deliveryDate}-${index}`}
            day={day}
            index={index}
            showMovements={showMovements}
            onChangeDay={updateDay}
            onRemoveDay={removeDay}
            canRemove={value.deliveryDays.length > 1}
          />
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={addDay}
          className="w-full sm:w-auto"
        >
          <Plus className="mr-1 h-4 w-4" />
          Add delivery day
        </Button>
      </div>

      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Order notes
        <Textarea
          value={value.notes}
          onChange={(event) => updateField("notes", event.target.value)}
          placeholder="Order notes"
          rows={4}
          maxLength={1000}
        />
      </label>
    </div>
  );
}

export default memo(FunctionOrderEditor);
