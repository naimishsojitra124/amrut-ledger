import {
  useEffect,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type WheelEvent,
} from "react";

import { Input } from "@/components/ui/input";

interface FunctionOrderNumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  decimalPlaces?: number;
  placeholder?: string;
  className?: string;
}

function normalizeNumber(value: number, decimalPlaces: number) {
  const factor = 10 ** decimalPlaces;

  return Math.round(value * factor) / factor;
}

function isValidInput(value: string, decimalPlaces: number) {
  if (decimalPlaces === 0) {
    return /^\d*$/.test(value);
  }

  return new RegExp(`^\\d*(\\.\\d{0,${decimalPlaces}})?$`).test(value);
}

export default function FunctionOrderNumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  decimalPlaces = 0,
  placeholder,
  className,
}: FunctionOrderNumberInputProps) {
  const [inputValue, setInputValue] = useState(String(value));

  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value;

    if (nextValue === "" || isValidInput(nextValue, decimalPlaces)) {
      setInputValue(nextValue);
    }
  }

  function commitValue() {
    if (inputValue === "") {
      setInputValue(String(value));
      return;
    }

    const parsed = Number(inputValue);

    if (!Number.isFinite(parsed)) {
      setInputValue(String(value));
      return;
    }

    const normalized = normalizeNumber(parsed, decimalPlaces);

    const minimum = min !== undefined ? Math.max(min, normalized) : normalized;

    const bounded = max !== undefined ? Math.min(max, minimum) : minimum;

    setInputValue(String(bounded));

    if (bounded !== value) {
      onChange(bounded);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (
      event.key === "e" ||
      event.key === "E" ||
      event.key === "+" ||
      event.key === "-"
    ) {
      event.preventDefault();
      return;
    }

    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
  }

  function handleWheel(event: WheelEvent<HTMLInputElement>) {
    event.preventDefault();
    event.currentTarget.blur();
  }

  return (
    <Input
      type="number"
      inputMode={decimalPlaces > 0 ? "decimal" : "numeric"}
      value={inputValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onWheel={handleWheel}
      onBlur={commitValue}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      className={className}
    />
  );
}
