import { Outlet } from "react-router-dom";

import { SuspenseLoader } from "@/components/common/suspense-loader";

export function RootLayout() {
  return (
    <SuspenseLoader>
      <Outlet />
    </SuspenseLoader>
  );
}