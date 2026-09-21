import { useMemo } from "react";
import { useAuthStore } from "@/store/auth.store";
import type { Permission, UserRole } from "@/config/permissions";

export const useAuth = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const isLoggingOut = useAuthStore((s) => s.isLoggingOut);

  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const initializeAuth = useAuthStore((s) => s.initializeAuth);

  const computed = useMemo(() => {
    const userName =
      user?.fullName?.trim() ||
      user?.mobileNumber ||
      "User";

    const userInitials =
      user?.fullName
        ? user.fullName
            .split(" ")
            .filter(Boolean)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()
        : user?.mobileNumber?.[0]?.toUpperCase() || "U";

    return {
      userName,
      userInitials,
      isOwner: user?.role === "owner",
      isManager: user?.role === "manager",
      isEmployee: user?.role === "employee",
      hasRole: (roles: UserRole[]) => !!user && roles.includes(user.role),
      /** Signed in through the public demo rather than as a real account. */
      isGuest: user?.role === "guest",
      can: (permission: Permission) => !!user?.permissions?.includes(permission),
    };
  }, [user]);

  return {
    isAuthenticated,
    isLoading,
    isLoggingOut,
    user,
    token,
    login,
    logout,
    setUser,
    setLoading,
    initializeAuth,
    ...computed,
  };
};
