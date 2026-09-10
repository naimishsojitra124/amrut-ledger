import { ErrorBoundary } from "react-error-boundary";

import { ErrorFallback } from "@/components/common/error-fallback";

import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { ToasterProvider } from "@/providers/toaster-provider";

interface AppProviderProps {
  children: React.ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <ThemeProvider>
        <QueryProvider>
          {/* <AuthBootstrap>{children}</AuthBootstrap> */}
          {children}

          <ToasterProvider />
        </QueryProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
