import { Suspense } from "react";

import { PageLoader } from "@/components/common/page-loader";

interface SuspenseLoaderProps {
  children: React.ReactNode;
}

export function SuspenseLoader({ children }: SuspenseLoaderProps) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}
