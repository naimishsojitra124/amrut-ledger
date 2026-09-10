import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <main className="min-h-dvh w-full">
      <Outlet />
    </main>
  );
}
