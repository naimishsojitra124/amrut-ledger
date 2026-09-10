import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";

interface StatCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  subTitle?: string;
  isLoading?: boolean;
}

export function StatCard({
  title,
  value,
  icon,
  subTitle,
  isLoading = false,
}: StatCardProps) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#E2E2E2] bg-white p-3 shadow-sm sm:gap-4 sm:p-4">
      <div
        aria-hidden="true"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#EFF4FE] sm:h-11 sm:w-11"
      >
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-[#757575]">
          {title}
        </span>

        {isLoading ? (
          <Skeleton className="mt-1 h-7 w-20 sm:w-24" />
        ) : (
          <span className="block truncate text-xl font-semibold text-[#121212] sm:text-2xl">
            {value}
          </span>
        )}

        {subTitle ? (
          <span className="mt-0.5 block truncate text-xs font-medium text-[#757575]">
            {subTitle}
          </span>
        ) : null}
      </div>
    </div>
  );
}