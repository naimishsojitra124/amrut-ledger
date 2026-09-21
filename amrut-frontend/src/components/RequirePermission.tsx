import { Navigate, Outlet } from "react-router-dom";
import { ShieldAlert } from "lucide-react";

import { usePermissions } from "@/hooks/use-permissions";
import type { Permission } from "@/config/permissions";

// Catches a typed or shared URL and explains the refusal instead of bouncing silently.
export default function RequirePermission({
  permission,
  redirectTo,
}: {
  permission: Permission;
  redirectTo?: string;
}) {
  const { can } = usePermissions();

  if (can(permission)) {
    return <Outlet />;
  }

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
        <ShieldAlert className="h-6 w-6 text-amber-600" />
      </div>

      <div>
        <p className="text-base font-semibold text-neutral-900">
          You don't have access to this page
        </p>

        <p className="mt-1 text-sm text-neutral-500">
          Ask an owner or manager if you need it.
        </p>
      </div>
    </div>
  );
}
