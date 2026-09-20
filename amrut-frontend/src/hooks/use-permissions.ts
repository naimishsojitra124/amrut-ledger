import { useCallback, useMemo } from "react";

import { useAuthStore } from "@/store/auth.store";
import type { Permission } from "@/config/permissions";

/**
 * What the signed-in user is allowed to do.
 *
 * The list comes from the server with their profile, so it always reflects
 * `amrut-backend/src/app/auth/permissions.ts` — the UI holds no copy of the
 * access matrix and cannot fall out of step with the API.
 */
export function usePermissions() {
  const user = useAuthStore((state) => state.user);

  const granted = useMemo(
    () => new Set<string>(user?.permissions ?? []),
    [user?.permissions],
  );

  const can = useCallback(
    (permission: Permission) => granted.has(permission),
    [granted],
  );

  const canAny = useCallback(
    (...permissions: Permission[]) =>
      permissions.some((permission) => granted.has(permission)),
    [granted],
  );

  const canAll = useCallback(
    (...permissions: Permission[]) =>
      permissions.every((permission) => granted.has(permission)),
    [granted],
  );

  return { can, canAny, canAll, permissions: granted, role: user?.role ?? null };
}

/**
 * Renders its children only when the user holds the permission.
 *
 * Pass `fallback` where the space needs filling — an explanation, or a disabled
 * control — rather than leaving a gap the user cannot account for.
 */
export function useCan(permission: Permission): boolean {
  const { can } = usePermissions();
  return can(permission);
}
