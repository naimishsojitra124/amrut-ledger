import type { ReactNode } from "react";

import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FilterSelectProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
  triggerClassName?: string;
};

export default function FilterSelect({
  label,
  value,
  onValueChange,
  children,
  className,
  triggerClassName,
}: FilterSelectProps) {
  return (
    <div className={`relative min-w-0 ${className ?? ""}`}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-2 left-3 z-10 bg-white px-1 text-[11px] font-medium text-neutral-500"
      >
        {label}
      </span>

      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          aria-label={label}
          className={`h-11 rounded-md ${triggerClassName ?? ""}`}
        >
          <SelectValue />
        </SelectTrigger>

        <SelectContent position="popper" align="start">
          {children}
        </SelectContent>
      </Select>
    </div>
  );
}
