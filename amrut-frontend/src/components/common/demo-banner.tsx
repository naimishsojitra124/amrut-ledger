import { Eye, LogOut } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

// Says the data is invented and the changes are temporary, so visitors try things freely.
export default function DemoBanner() {
  const { isGuest, logout, isLoggingOut } = useAuth();

  if (!isGuest) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm text-amber-900">
      <span className="flex items-center gap-2">
        <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          <strong className="font-semibold">Demo mode.</strong> Sample data —
          change anything you like, it all resets periodically.
        </span>
      </span>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 border-amber-300 bg-white/60 text-amber-900 hover:bg-white"
        disabled={isLoggingOut}
        onClick={() => void logout()}
      >
        <LogOut className="mr-1.5 h-3.5 w-3.5" />
        Leave demo
      </Button>
    </div>
  );
}
