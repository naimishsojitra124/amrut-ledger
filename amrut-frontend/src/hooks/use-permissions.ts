import { useCallback, useMemo } from "react";

import { useAuthStore } from "@/store/auth.store";
import type { Permission } from "@/config/permissions";

// Reads the server's resolved list, so the UI can never drift from the access matrix.
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

