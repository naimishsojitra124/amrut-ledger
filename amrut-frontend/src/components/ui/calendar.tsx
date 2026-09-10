import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { cn } from "@/lib/utils";

export function Calendar({ className, ...props }: React.ComponentProps<typeof DayPicker>) {
  return <DayPicker className={cn("p-2", className)} classNames={{ month_caption: "flex h-9 items-center justify-center text-sm font-medium", nav: "flex items-center gap-1", button_previous: "absolute left-2 top-2 rounded-md p-1 hover:bg-slate-100", button_next: "absolute right-2 top-2 rounded-md p-1 hover:bg-slate-100", weekday: "w-9 text-center text-xs font-normal text-slate-500", day: "h-9 w-9 p-0 text-center text-sm", day_button: "h-9 w-9 rounded-md hover:bg-slate-100 aria-selected:bg-[#266699] aria-selected:text-white", selected: "bg-transparent", today: "font-bold text-[#266699]", outside: "text-slate-300", ...props.classNames }} {...props} />;
}
