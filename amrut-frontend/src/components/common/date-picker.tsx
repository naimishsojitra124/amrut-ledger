import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { cn } from "@/lib/utils";

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
};

export function DatePicker({
  value,
  onChange,
  className,
  disabled = false,
}: DatePickerProps) {
  const selected = value ? parseISO(`${value}T00:00:00`) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label="Select entry date"
          className={cn(
            "w-full min-w-0 justify-start text-left font-normal",
            !value && "text-slate-500",
            className,
          )}
        >
          <CalendarDays className="mr-2 h-4 w-4 shrink-0" />

          <span className="truncate">
            {selected ? format(selected, "dd MMM yyyy") : "Select date"}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-auto max-w-[calc(100vw-1rem)] p-0"
        align="start"
      >
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (date) {
              onChange(format(date, "yyyy-MM-dd"));
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
