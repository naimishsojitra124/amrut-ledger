import { Navigate, Outlet } from "react-router-dom";
import { ShieldAlert } from "lucide-react";

import { usePermissions } from "@/hooks/use-permissions";
import type { Permission } from "@/config/permissions";

/**
 * Route guard for pages that need a specific permission.
 *
 * The sidebar already hides links a user cannot follow; this catches the URL
 * being typed, bookmarked or shared. It explains the refusal rather than
 * bouncing silently, so nobody is left wondering whether the app is broken.
 *
 * This is not the security boundary — the API rejects the underlying requests
 * regardless of what the UI renders.
 */
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
