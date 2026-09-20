import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import { lazy } from "react";
import "./App.css";

import { RootLayout } from "./layouts/root-layout";
import { AppLayout } from "./layouts/app-layout";
import ProtectedRoute from "./components/ProtectedRoute";
import RequirePermission from "./components/RequirePermission";
import { PERMISSIONS } from "@/config/permissions";
import AuthBootstrap from "./components/AuthBootstrap";
import { SuspenseLoader } from "./components/common/suspense-loader";
import { OfflineSyncManager } from "./components/offline-sync-manager";
import { useAuthStore } from "@/store/auth.store";

const Dashboard = lazy(() => import("@/pages/dashboard"));
const Customers = lazy(() => import("@/pages/customers"));
const QuickEntry = lazy(() => import("@/pages/quick-entry"));
const Bills = lazy(() => import("@/pages/bills"));
const Settings = lazy(() => import("@/pages/settings"));
const Login = lazy(() => import("@/pages/login"));
const FunctionOrders = lazy(() => import("@/pages/function-orders"));
const NotFound = lazy(() => import("@/pages/not-found"));

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        path: "login",
        element: <Login />,
      },

      {
        element: <ProtectedRoute />,
        children: [
          {
            path: "/",
            element: <AppLayout />,
            children: [
              {
                index: true,
                element: <Navigate to="/dashboard" replace />,
              },
              {
                path: "dashboard",
                element: <Dashboard />,
              },
              // Each page declares the permission it needs. The sidebar hides
              // links a user cannot follow; this stops the URL being reached
              // directly. The API enforces the same rules independently.
              {
                element: (
                  <RequirePermission permission={PERMISSIONS.CUSTOMER_VIEW} />
                ),
                children: [{ path: "customers", element: <Customers /> }],
              },
              {
                element: (
                  <RequirePermission
                    permission={PERMISSIONS.LEDGER_ENTRY_CREATE}
                  />
                ),
                children: [{ path: "quick-entry", element: <QuickEntry /> }],
              },
              {
                element: <RequirePermission permission={PERMISSIONS.BILL_VIEW} />,
                children: [{ path: "bills", element: <Bills /> }],
              },
              {
                element: (
                  <RequirePermission
                    permission={PERMISSIONS.FUNCTION_ORDER_VIEW}
                  />
                ),
                children: [
                  { path: "function-orders", element: <FunctionOrders /> },
                ],
              },
              {
                path: "settings",
                element: <Settings />,
              },

            ],
          },
        ],
      },

      // Reached when nobody is signed in: no shell to keep them in, so the
      // page stands alone and points at the login screen.
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
]);

function AuthLoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />

        <p className="text-sm font-medium text-neutral-600">
          Loading Amrut Ledger...
        </p>
      </div>
    </div>
  );
}

function App() {
  const isAuthLoading = useAuthStore((state) => state.isLoading);

  return (
    <>
      <AuthBootstrap />

      {isAuthLoading ? (
        <AuthLoadingScreen />
      ) : (
        <>
          <OfflineSyncManager />

          <SuspenseLoader>
            <RouterProvider router={router} />
          </SuspenseLoader>
        </>
      )}
    </>
  );
}

export default App;
