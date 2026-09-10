import { memo } from "react";

import type { FunctionOrderAuditLog as FunctionOrderAuditLogType } from "@/types/function-order";

interface FunctionOrderAuditLogProps {
  logs: FunctionOrderAuditLogType[];
  isLoading: boolean;
}

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatAction(action: string) {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function FunctionOrderAuditLog({
  logs,
  isLoading,
}: FunctionOrderAuditLogProps) {
  return (
    <section className="mt-6 border-t pt-5">
      <h3 className="text-base font-semibold">Order activity</h3>

      <div className="mt-3 space-y-2">
        {logs.map((log) => (
          <div
            key={log.id}
            className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm"
          >
            <div className="grid gap-1 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start sm:gap-3">
              <span className="font-medium">{formatAction(log.action)}</span>

              <span className="wrap-break-word text-slate-500">{log.details}</span>

              <time
                dateTime={log.performedAt}
                className="text-xs text-slate-400 sm:text-right sm:text-sm"
              >
                {DATE_TIME_FORMATTER.format(new Date(log.performedAt))}
              </time>
            </div>
          </div>
        ))}

        {!isLoading && logs.length === 0 ? (
          <p className="text-sm text-slate-500">No activity yet.</p>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-slate-500">Loading activity…</p>
        ) : null}
      </div>
    </section>
  );
}

export default memo(FunctionOrderAuditLog);
