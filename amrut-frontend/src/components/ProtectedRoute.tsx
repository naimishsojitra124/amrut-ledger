import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/auth.store";
import { AuthLoadingScreen } from "@/components/common/auth-loading-screen";

export default function ProtectedRoute() {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuthStore();

  // Wait for the refresh call only when the last visit left a session behind.
  // Redirecting while it is in flight would sign out a good session just because a
  // cold backend had not answered yet; waiting when there is nothing to restore
  // would hold a first-time visitor on a spinner for the whole cold start.
  if (isLoading && isAuthenticated) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
