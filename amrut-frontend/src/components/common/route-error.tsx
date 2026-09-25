import { useEffect } from "react";
import { useRouteError } from "react-router-dom";

import { ErrorFallback } from "@/components/common/error-fallback";
import {
  canReloadForNewVersion,
  isStaleChunkError,
  reloadForNewVersion,
} from "@/lib/stale-deploy";

/**
 * Router errors never reach the ErrorBoundary in AppProvider, so without this the
 * router's own developer screen is what a user sees.
 */
export function RouteError() {
  const error = useRouteError();

  // A chunk the current deploy no longer has. One reload fixes it; a second would only
  // loop, so past the cooldown the failure is shown rather than retried.
  const willReload = isStaleChunkError(error) && canReloadForNewVersion();

  useEffect(() => {
    if (willReload) reloadForNewVersion();
  }, [willReload]);

  if (willReload) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />

          <p className="text-sm font-medium text-neutral-600">
            Updating to the latest version...
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorFallback
      error={
        isStaleChunkError(error)
          ? new Error(
              "A newer version of Amrut Ledger is available, but it could not be loaded. Check your connection and try again.",
            )
          : error instanceof Error
            ? error
            : new Error(String(error ?? "Something went wrong."))
      }
      resetErrorBoundary={() => window.location.reload()}
    />
  );
}
