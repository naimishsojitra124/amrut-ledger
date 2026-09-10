"use client";

import * as React from "react";

import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

type DateTimePickerProps = {
  dateLabel: string;
  timeLabel: string;
  dateValue: string;
  dateOnChange: (value: string) => void;
  timeValue: string;
  timeOnChange: (value: string) => void;
  dateClassName?: string;
  dateDisabled?: boolean;
};

export function DateTimePicker({
  dateLabel,
  timeLabel,
  dateValue,
  dateOnChange,
  timeValue,
  timeOnChange,
  dateClassName,
  dateDisabled,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);

  const dateSelected = dateValue
    ? parseISO(`${dateValue}T00:00:00`)
    : undefined;

  return (
    <FieldGroup className="grid w-full gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
      <Field className="min-w-0">
        <FieldLabel
          htmlFor="date-picker-optional"
          className="text-xs font-medium text-neutral-600"
        >
          {dateLabel}
        </FieldLabel>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger id="date-picker-optional" asChild>
            <Button
              type="button"
              variant="outline"
              disabled={dateDisabled}
              className={cn(
                "w-full min-w-0 justify-start text-left font-normal",
                !dateValue && "text-neutral-500",
                dateClassName,
              )}
            >
              <CalendarDays className="mr-2 h-4 w-4 shrink-0" />

              <span className="truncate">
                {dateSelected
                  ? format(dateSelected, "dd MMM yyyy")
                  : "Select date"}
              </span>
            </Button>
          </PopoverTrigger>

          <PopoverContent
            className="w-auto max-w-[calc(100vw-1rem)] overflow-hidden p-0"
            align="start"
          >
            <Calendar
              mode="single"
              captionLayout="dropdown"
              selected={dateSelected}
              onSelect={(date) => {
                if (date) {
                  dateOnChange(format(date, "yyyy-MM-dd"));
                  setOpen(false);
                }
              }}
            />
          </PopoverContent>
        </Popover>
      </Field>

      <Field className="min-w-0">
        <FieldLabel
          htmlFor="time-picker-optional"
          className="text-xs font-medium text-neutral-600"
        >
          {timeLabel}
        </FieldLabel>

        <Input
          type="time"
          id="time-picker-optional"
          step="60"
          value={timeValue}
          onChange={(event) => timeOnChange(event.target.value)}
          className="w-full appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
        />
      </Field>
    </FieldGroup>
  );
}
