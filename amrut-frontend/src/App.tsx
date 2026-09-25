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
import { RouteError } from "./components/common/route-error";
import { OfflineSyncManager } from "./components/offline-sync-manager";
import { RealtimeSync } from "./components/realtime-sync";
import { useAuthStore } from "@/store/auth.store";

const Dashboard = lazy(() => import("@/pages/dashboard"));
const Customers = lazy(() => import("@/pages/customers"));
const QuickEntry = lazy(() => import("@/pages/quick-entry"));
const Bills = lazy(() => import("@/pages/bills"));
const Settings = lazy(() => import("@/pages/settings"));
const Login = lazy(() => import("@/pages/login"));
const FunctionOrders = lazy(() => import("@/pages/function-orders"));
const NotFound = lazy(() => import("@/pages/not-found"));

// The catch-all sits outside the auth gate, so signed-out visitors get the 404 and not a redirect.
export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RouteError />,
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
                element: (
                  <RequirePermission permission={PERMISSIONS.BILL_VIEW} />
                ),
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

      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
]);

function App() {
  const isAuthLoading = useAuthStore((state) => state.isLoading);

  return (
    <>
      <AuthBootstrap />

      {/* Nothing to sync or subscribe to until we know who is signed in. */}
      {isAuthLoading ? null : (
        <>
          <OfflineSyncManager />

          <RealtimeSync />
        </>
      )}

      {/* Rendered straight away. On a cold free-tier backend the refresh call can take
          the best part of a minute, and a signed-out visitor should not wait for it to
          fail before the login page appears. ProtectedRoute holds the routes that do
          depend on the answer. */}
      <SuspenseLoader>
        <RouterProvider router={router} />
      </SuspenseLoader>
    </>
  );
}

export default App;
