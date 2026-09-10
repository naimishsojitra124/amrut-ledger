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
import AuthBootstrap from "./components/AuthBootstrap";
import { SuspenseLoader } from "./components/common/suspense-loader";
import { OfflineSyncManager } from "./components/offline-sync-manager";
import { AppModals } from "./components/modals";
import { useAuthStore } from "@/store/auth.store";

const Dashboard = lazy(() => import("@/pages/dashboard"));
const Customers = lazy(() => import("@/pages/customers"));
const QuickEntry = lazy(() => import("@/pages/quick-entry"));
const Bills = lazy(() => import("@/pages/bills"));
const Settings = lazy(() => import("@/pages/settings"));
const Login = lazy(() => import("@/pages/login"));
const FunctionOrders = lazy(() => import("@/pages/function-orders"));

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
              {
                path: "customers",
                element: <Customers />,
              },
              {
                path: "quick-entry",
                element: <QuickEntry />,
              },
              {
                path: "bills",
                element: <Bills />,
              },
              {
                path: "settings",
                element: <Settings />,
              },
              {
                path: "function-orders",
                element: <FunctionOrders />,
              },
            ],
          },
        ],
      },

      {
        path: "*",
        element: <Navigate to="/dashboard" replace />,
      },
    ],
  },
]);

function AuthLoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />

        <p className="text-sm font-medium text-slate-600">
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
          <AppModals />

          <SuspenseLoader>
            <RouterProvider router={router} />
          </SuspenseLoader>
        </>
      )}
    </>
  );
}

export default App;
