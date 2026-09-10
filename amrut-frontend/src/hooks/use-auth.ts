import { useMemo } from "react";
import { useAuthStore } from "@/store/auth.store";

export const useAuth = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

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
      hasRole: (roles: Array<"owner" | "manager" | "employee">) =>
        !!user && roles.includes(user.role),
    };
  }, [user]);

  return {
    isAuthenticated,
    isLoading,
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