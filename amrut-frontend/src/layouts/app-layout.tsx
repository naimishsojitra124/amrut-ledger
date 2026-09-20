import { Menu } from "lucide-react";
import { Outlet } from "react-router-dom";

import { useServiceHealthQuery } from "@/services/health.service";
import { useSidebar } from "@/hooks/use-sidebar";

import { Button } from "@/components/ui/button";
import Sidebar from "@/components/Sidebar";
import DemoBanner from "@/components/common/demo-banner";
import { AppModals } from "@/components/modals";

export function AppLayout() {
  const healthQuery = useServiceHealthQuery();
  const { open } = useSidebar();

  const isOnline = healthQuery.data?.status === "ok";

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[#F8FAFC]">
      <Sidebar />

      {/* Mounted here rather than at the app root so the login screen does
          not carry a dozen modals — and the queries behind them. */}
      <AppModals />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DemoBanner />

        {!healthQuery.isLoading && (
          <div
            className={[
              "flex min-h-7 shrink-0 items-center justify-center px-3 text-center text-xs font-medium",
              isOnline
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700",
            ].join(" ")}
          >
            <span
              className={[
                "mr-2 h-2 w-2 shrink-0 rounded-full",
                isOnline ? "bg-emerald-500" : "bg-red-500",
              ].join(" ")}
            />

            <span className="truncate">
              {isOnline
                ? "Service connected"
                : "Service unavailable — retrying automatically"}
            </span>
          </div>
        )}

        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[#E2E8F0] bg-white px-3 md:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={open}
            aria-label="Open navigation menu"
            className="h-9 w-9"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <span className="text-sm font-semibold text-[#121212]">
            Amrut Ledger
          </span>
        </header>

        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
