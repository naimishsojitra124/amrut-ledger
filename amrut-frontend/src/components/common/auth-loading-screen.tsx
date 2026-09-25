// Shown while the refresh cookie is being exchanged on a protected route. A signed-out
// visitor never sees it: the login page renders without waiting for that call.
export function AuthLoadingScreen() {
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
