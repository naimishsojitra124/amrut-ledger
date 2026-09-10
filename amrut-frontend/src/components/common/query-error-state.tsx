import { AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

type QueryErrorStateProps = {
  error?: unknown;
  onRetry: () => void;
  className?: string;
};

export function QueryErrorState({
  onRetry,
  className = "",
}: QueryErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex min-h-32 flex-col items-center justify-center gap-3 px-4 text-center sm:px-6 ${className}`}
    >
      <AlertCircle aria-hidden="true" className="h-6 w-6 text-red-500" />

      <p className="max-w-md text-sm text-red-600">
        Unable to load this data. Please try again.
      </p>

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onRetry}
        className="gap-2"
      >
        <RefreshCw aria-hidden="true" className="h-4 w-4" />
        Retry
      </Button>
    </div>
  );
}
