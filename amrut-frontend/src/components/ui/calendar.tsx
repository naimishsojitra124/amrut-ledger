import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { cn } from "@/lib/utils";

export function Calendar({
  className,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      className={cn("p-2", className)}
      classNames={{
        month_caption:
          "flex h-9 items-center justify-center text-sm font-medium text-neutral-900",
        nav: "flex items-center gap-1",
        button_previous:
          "absolute left-2 top-2 rounded-lg border border-slate-200 bg-white p-1.5 text-[#266699] shadow-sm transition hover:bg-blue-50 hover:text-[#266699] disabled:cursor-not-allowed disabled:opacity-35",
        button_next:
          "absolute right-2 top-2 rounded-lg border border-slate-200 bg-white p-1.5 text-[#266699] shadow-sm transition hover:bg-blue-50 hover:text-[#266699] disabled:cursor-not-allowed disabled:opacity-35",
        weekday: "w-9 text-center text-xs font-medium text-slate-500",
        day: "h-9 w-9 p-0 text-center text-sm",
        day_button:
          "h-9 w-9 rounded-lg text-neutral-700 transition hover:bg-blue-50 hover:text-[#266699] aria-selected:bg-[#266699] aria-selected:text-white aria-selected:hover:bg-[#266699]",
        selected: "bg-transparent",
        today: "font-bold text-[#266699]",
        outside: "text-slate-300",
        disabled: "cursor-not-allowed text-slate-300 opacity-60",
        ...props.classNames,
      }}
      {...props}
    />
  );
}
