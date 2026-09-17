import {
  addMonths,
  format,
  getYear,
  isAfter,
  isSameMonth,
  parseISO,
  setMonth,
  setYear,
  startOfMonth,
  subMonths,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
};

type PickerView = "calendar" | "months" | "years";

const MONTHS = Array.from({ length: 12 }, (_, index) =>
  format(new Date(2020, index, 1), "MMM"),
);

function getInitialMonth(value: string, today: Date) {
  if (!value) {
    return startOfMonth(today);
  }

  const parsed = parseISO(`${value}T00:00:00`);

  return isAfter(parsed, today)
    ? startOfMonth(today)
    : startOfMonth(parsed);
}

function getYearPageStart(year: number) {
  return Math.floor(year / 12) * 12;
}

export function DatePicker({
  value,
  onChange,
  className,
  disabled = false,
}: DatePickerProps) {
  const today = useMemo(() => new Date(), []);
  const todayMonth = startOfMonth(today);
  const selected = value ? parseISO(`${value}T00:00:00`) : undefined;

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PickerView>("calendar");
  const [visibleMonth, setVisibleMonth] = useState<Date>(() =>
    getInitialMonth(value, today),
  );
  const [yearPageStart, setYearPageStart] = useState(() =>
    getYearPageStart(getInitialMonth(value, today).getFullYear()),
  );

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      setView("calendar");
      return;
    }

    const nextMonth = getInitialMonth(value, today);

    setVisibleMonth(nextMonth);
    setYearPageStart(getYearPageStart(getYear(nextMonth)));
    setView("calendar");
  }

  function handleSelect(date: Date | undefined) {
    if (!date || isAfter(date, today)) {
      return;
    }

    onChange(format(date, "yyyy-MM-dd"));
    setVisibleMonth(startOfMonth(date));
    setOpen(false);
    setView("calendar");
  }

  function handleMonthSelect(monthIndex: number) {
    const nextMonth = setMonth(visibleMonth, monthIndex);

    if (isAfter(nextMonth, todayMonth)) {
      return;
    }

    setVisibleMonth(startOfMonth(nextMonth));
    setView("calendar");
  }

  function handleYearSelect(year: number) {
    let nextMonth = setYear(visibleMonth, year);

    if (isAfter(nextMonth, todayMonth)) {
      nextMonth = todayMonth;
    }

    setVisibleMonth(startOfMonth(nextMonth));
    setView("calendar");
  }

  const yearRangeEnd = yearPageStart + 11;
  const yearOptions = Array.from(
    { length: 12 },
    (_, index) => yearPageStart + index,
  );

  const isNextMonthDisabled = isSameMonth(visibleMonth, todayMonth);
  const isNextYearPageDisabled = yearRangeEnd >= getYear(today);
  const yearPageLabel = `${yearPageStart}-${yearRangeEnd}`;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
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
          <CalendarDays className="mr-2 h-4 w-4 shrink-0 text-[#266699]" />

          <span className="truncate">
            {selected && !isAfter(selected, today)
              ? format(selected, "dd MMM yyyy")
              : "Select date"}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border-slate-200 p-0 shadow-lg"
        align="start"
      >
        <div className="border-b bg-white px-3 py-3">
          <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Previous month"
              className="h-9 w-9 rounded-lg border-slate-200 text-[#266699] hover:bg-blue-50 hover:text-[#266699]"
              onClick={() => setVisibleMonth(subMonths(visibleMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex min-w-0 justify-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setYearPageStart(getYearPageStart(getYear(visibleMonth)));
                  setView("years");
                }}
                className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-neutral-900 transition hover:bg-blue-50 hover:text-[#266699]"
                aria-label="Choose year"
              >
                {getYear(visibleMonth)}
              </button>

              <button
                type="button"
                onClick={() => setView("months")}
                className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-neutral-900 transition hover:bg-blue-50 hover:text-[#266699]"
                aria-label="Choose month"
              >
                {format(visibleMonth, "MMMM")}
              </button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Next month"
              disabled={isNextMonthDisabled}
              className="h-9 w-9 rounded-lg border-slate-200 text-[#266699] hover:bg-blue-50 hover:text-[#266699] disabled:cursor-not-allowed disabled:opacity-35"
              onClick={() => {
                const nextMonth = addMonths(visibleMonth, 1);

                if (!isAfter(nextMonth, todayMonth)) {
                  setVisibleMonth(nextMonth);
                }
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {view === "calendar" && (
          <Calendar
            mode="single"
            month={visibleMonth}
            onMonthChange={setVisibleMonth}
            selected={
              selected && !isAfter(selected, today) ? selected : undefined
            }
            onSelect={handleSelect}
            disabled={{ after: today }}
            hideNavigation
            className="w-full p-3"
            classNames={{
              month_caption: "hidden",
            }}
          />
        )}

        {view === "months" && (
          <div className="p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Select month
              </p>

              <span className="text-sm font-semibold text-neutral-900">
                {getYear(visibleMonth)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {MONTHS.map((month, index) => {
                const monthDate = setMonth(visibleMonth, index);
                const isFuture = isAfter(monthDate, todayMonth);
                const isSelectedMonth = index === visibleMonth.getMonth();

                return (
                  <button
                    key={month}
                    type="button"
                    disabled={isFuture}
                    onClick={() => handleMonthSelect(index)}
                    className={cn(
                      "h-10 rounded-lg text-sm font-medium transition",
                      isSelectedMonth
                        ? "bg-[#266699] text-white shadow-sm"
                        : "text-neutral-700 hover:bg-blue-50 hover:text-[#266699]",
                      isFuture &&
                        "cursor-not-allowed text-neutral-300 hover:bg-transparent",
                    )}
                  >
                    {month}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {view === "years" && (
          <div className="p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Previous years"
                className="h-8 w-8 rounded-lg border-slate-200 text-[#266699] hover:bg-blue-50 hover:text-[#266699]"
                onClick={() => setYearPageStart((year) => year - 12)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <p className="text-sm font-semibold text-neutral-900">
                {yearPageLabel}
              </p>

              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Next years"
                disabled={isNextYearPageDisabled}
                className="h-8 w-8 rounded-lg border-slate-200 text-[#266699] hover:bg-blue-50 hover:text-[#266699] disabled:cursor-not-allowed disabled:opacity-35"
                onClick={() =>
                  setYearPageStart((year) =>
                    Math.min(year + 12, getYear(today)),
                  )
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {yearOptions.map((year) => {
                const isFuture = year > getYear(today);
                const isSelectedYear = year === getYear(visibleMonth);

                return (
                  <button
                    key={year}
                    type="button"
                    disabled={isFuture}
                    onClick={() => handleYearSelect(year)}
                    className={cn(
                      "h-10 rounded-lg text-sm font-medium transition",
                      isSelectedYear
                        ? "bg-[#266699] text-white shadow-sm"
                        : "text-neutral-700 hover:bg-blue-50 hover:text-[#266699]",
                      isFuture &&
                        "cursor-not-allowed text-neutral-300 hover:bg-transparent",
                    )}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="border-t bg-slate-50/70 px-3 py-2.5 text-center text-xs text-neutral-500">
          Future dates are unavailable
        </div>
      </PopoverContent>
    </Popover>
  );
}
