import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Droplets,
  FileText,
  Filter,
  IndianRupee,
  Info,
  Loader2,
  NotebookPen,
  PencilLine,
  Plus,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useCustomerAuditLogsQuery } from "@/services/customer.service";
import type {
  AuditLogType,
  CustomerAuditLogItemResponse,
} from "@/types/customer";

type Props = {
  customerId: string;
};

type AuditRow = {
  log: CustomerAuditLogItemResponse;
  dateLabel: string;
  timeLabel: string;
};

type AuditEntryValue = {
  milkTypeId?: string;
  rate?: number;
  litres?: number;
  amount?: number;
  productEntries?: Array<{
    productSuggestionId?: string;
    quantity?: number;
    rate?: number;
    amount?: number;
  }>;
};

type ActionMeta = {
  label: string;
  tone: string;
  icon: typeof UserRound;
};

const ALL_AUDIT_TYPES: AuditLogType[] = [
  "customer_created",
  "customer_updated",
  "customer_closed",
  "customer_reopened",
  "card_assigned",
  "card_unassigned",
  "milk_type_changed",
  "deposit_updated",
  "entry_added",
  "entry_updated",
  "entry_deleted",
  "bill_generated",
  "payment_added",
  "note_added",
];

const PAGE_SIZE = 10;

const DATE_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
});

const ACTION_META: Record<AuditLogType, ActionMeta> = {
  customer_created: {
    label: "Customer Created",
    tone: "text-emerald-600 border-emerald-500",
    icon: UserRound,
  },
  customer_updated: {
    label: "Customer Updated",
    tone: "text-emerald-600 border-emerald-500",
    icon: UserRound,
  },
  customer_closed: {
    label: "Customer Closed",
    tone: "text-red-600 border-red-500",
    icon: UserRound,
  },
  customer_reopened: {
    label: "Customer Reopened",
    tone: "text-emerald-600 border-emerald-500",
    icon: UserRound,
  },
  card_assigned: {
    label: "Card Assigned",
    tone: "text-blue-600 border-blue-500",
    icon: CircleAlert,
  },
  card_unassigned: {
    label: "Card Unassigned",
    tone: "text-red-600 border-red-500",
    icon: CircleAlert,
  },
  milk_type_changed: {
    label: "Milk Type Changed",
    tone: "text-blue-600 border-blue-500",
    icon: Droplets,
  },
  deposit_updated: {
    label: "Deposit Updated",
    tone: "text-violet-600 border-violet-500",
    icon: IndianRupee,
  },
  entry_added: {
    label: "Entry Added",
    tone: "text-orange-600 border-orange-500",
    icon: Plus,
  },
  entry_updated: {
    label: "Entry Edited",
    tone: "text-orange-600 border-orange-500",
    icon: PencilLine,
  },
  entry_deleted: {
    label: "Entry Deleted",
    tone: "text-red-600 border-red-500",
    icon: Trash2,
  },
  bill_generated: {
    label: "Bill Generated",
    tone: "text-blue-600 border-blue-500",
    icon: FileText,
  },
  payment_added: {
    label: "Payment Added",
    tone: "text-emerald-600 border-emerald-500",
    icon: Wallet,
  },
  note_added: {
    label: "Note Added",
    tone: "text-violet-600 border-violet-500",
    icon: NotebookPen,
  },
};

const HIDDEN_AUDIT_FIELDS = new Set([
  "id",
  "_id",
  "createdAt",
  "updatedAt",
  "createdById",
  "updatedById",
  "customerId",
  "milkTypeId",
  "productSuggestionId",
]);

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function parseAuditValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function formatCurrencyValue(value: unknown) {
  const amount = Number(value);

  return Number.isFinite(amount)
    ? `₹${amount.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : "—";
}

function formatLitres(value: unknown) {
  const litres = Number(value);

  return Number.isFinite(litres)
    ? `${litres.toLocaleString("en-IN", {
        maximumFractionDigits: 2,
      })} L`
    : "—";
}

function isAuditEntryValue(value: unknown): value is AuditEntryValue {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    ("litres" in value ||
      "rate" in value ||
      "amount" in value ||
      "milkTypeId" in value)
  );
}

function getAuditEntries(value: unknown): AuditEntryValue[] {
  const parsed = parseAuditValue(value);

  if (Array.isArray(parsed)) {
    return parsed.filter(isAuditEntryValue);
  }

  return isAuditEntryValue(parsed) ? [parsed] : [];
}

function formatAuditFieldName(field: string) {
  return field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatGenericAuditValue(value: unknown): string {
  const parsed = parseAuditValue(value);

  if (parsed === null || parsed === undefined || parsed === "") {
    return "";
  }

  if (
    typeof parsed === "string" ||
    typeof parsed === "number" ||
    typeof parsed === "boolean"
  ) {
    return String(parsed);
  }

  if (Array.isArray(parsed)) {
    return parsed.map(formatGenericAuditValue).filter(Boolean).join(", ");
  }

  if (typeof parsed === "object") {
    const objectValue = parsed as Record<string, unknown>;

    const preferredKeys = [
      "fullName",
      "name",
      "label",
      "title",
      "amount",
      "quantity",
      "rate",
      "litres",
      "referenceNumber",
      "receiptNumber",
      "billNumber",
    ];

    for (const key of preferredKeys) {
      const candidate = objectValue[key];

      if (candidate !== undefined && candidate !== null && candidate !== "") {
        return formatGenericAuditValue(candidate);
      }
    }

    return Object.entries(objectValue)
      .filter(
        ([key, entryValue]) =>
          !HIDDEN_AUDIT_FIELDS.has(key) &&
          entryValue !== undefined &&
          entryValue !== null &&
          entryValue !== "",
      )
      .map(
        ([key, entryValue]) =>
          `${formatAuditFieldName(key)}: ${formatGenericAuditValue(
            entryValue,
          )}`,
      )
      .join(", ");
  }

  return String(parsed);
}

function renderMilkEntry(entry: AuditEntryValue) {
  const litres = Number(entry.litres);
  const rate = Number(entry.rate);
  const amount = Number(entry.amount);

  const hasLitres = Number.isFinite(litres);
  const hasRate = Number.isFinite(rate);
  const hasAmount = Number.isFinite(amount);

  return (
    <div className="rounded-md bg-neutral-50 px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
        {hasLitres && (
          <span className="font-medium text-neutral-800">
            {formatLitres(litres)}
          </span>
        )}

        {hasLitres && hasRate && <span className="text-neutral-400">×</span>}

        {hasRate && (
          <span className="font-medium text-neutral-700">
            {formatCurrencyValue(rate)}
          </span>
        )}

        {hasAmount && (
          <>
            <span className="text-neutral-400">=</span>
            <span className="font-semibold text-neutral-800">
              {formatCurrencyValue(amount)}
            </span>
          </>
        )}
      </div>

      {entry.productEntries?.length ? (
        <p className="mt-1 text-[11px] text-neutral-500">
          + {entry.productEntries.length} product{" "}
          {entry.productEntries.length === 1 ? "item" : "items"}
        </p>
      ) : null}
    </div>
  );
}

function renderEntryDetails(log: CustomerAuditLogItemResponse) {
  const change = log.details[0];

  if (!change) {
    return null;
  }

  const oldEntries = getAuditEntries(change.oldValue);
  const newEntries = getAuditEntries(change.newValue);

  if (!oldEntries.length && !newEntries.length) {
    return null;
  }

  if (log.type === "entry_added") {
    return (
      <AuditDetailGroup label="Milk Entry">
        {newEntries.map((entry, index) => (
          <div key={index}>{renderMilkEntry(entry)}</div>
        ))}
      </AuditDetailGroup>
    );
  }

  if (log.type === "entry_deleted") {
    return (
      <AuditDetailGroup label="Deleted Entry" labelClassName="text-red-600">
        {oldEntries.map((entry, index) => (
          <div key={index}>{renderMilkEntry(entry)}</div>
        ))}
      </AuditDetailGroup>
    );
  }

  if (log.type === "entry_updated") {
    return (
      <div className="space-y-2">
        <p className="text-[12px] font-medium text-neutral-600">
          Milk Entry Changed
        </p>

        {oldEntries.length > 0 && (
          <AuditEntrySection label="Before" tone="red">
            {oldEntries.map((entry, index) => (
              <div key={index}>{renderMilkEntry(entry)}</div>
            ))}
          </AuditEntrySection>
        )}

        {oldEntries.length > 0 && newEntries.length > 0 && (
          <div className="text-center text-neutral-400">↓</div>
        )}

        {newEntries.length > 0 && (
          <AuditEntrySection label="After" tone="green">
            {newEntries.map((entry, index) => (
              <div key={index}>{renderMilkEntry(entry)}</div>
            ))}
          </AuditEntrySection>
        )}
      </div>
    );
  }

  return null;
}

function AuditDetailGroup({
  label,
  labelClassName,
  children,
}: {
  label: string;
  labelClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p
        className={cn(
          "text-[12px] font-medium text-neutral-600",
          labelClassName,
        )}
      >
        {label}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function AuditEntrySection({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "red" | "green";
  children: React.ReactNode;
}) {
  return (
    <div>
      <p
        className={cn(
          "mb-1 text-[11px] font-medium uppercase tracking-wide",
          tone === "red" ? "text-red-600" : "text-emerald-600",
        )}
      >
        {label}
      </p>

      <div className="space-y-1">{children}</div>
    </div>
  );
}

function renderDetails(log: CustomerAuditLogItemResponse) {
  if (!log.details?.length) {
    return <p className="text-[13px] leading-5 text-neutral-600">—</p>;
  }

  if (
    log.type === "entry_added" ||
    log.type === "entry_updated" ||
    log.type === "entry_deleted"
  ) {
    const entryDetails = renderEntryDetails(log);

    if (entryDetails) {
      return entryDetails;
    }
  }

  const change = log.details[0];

  if (log.type === "deposit_updated") {
    const oldAmount = formatGenericAuditValue(change?.oldValue) || "—";
    const newAmount = formatGenericAuditValue(change?.newValue) || "—";

    return (
      <AuditChange
        label={change?.field || "Deposit Amount"}
        oldValue={oldAmount}
        newValue={newAmount}
      />
    );
  }

  if (log.type === "milk_type_changed") {
    const oldMilk = formatGenericAuditValue(change?.oldValue) || "Old Milk";
    const newMilk = formatGenericAuditValue(change?.newValue) || "New Milk";

    return (
      <AuditChange
        label={change?.field ?? "Primary Milk"}
        oldValue={oldMilk}
        newValue={newMilk}
        oldClassName="bg-emerald-50 text-emerald-700"
        newClassName="bg-blue-50 text-blue-700"
      />
    );
  }

  return (
    <div className="space-y-1">
      {log.details.map((detail, index) => {
        const oldValue = formatGenericAuditValue(detail.oldValue);
        const newValue = formatGenericAuditValue(detail.newValue);

        return (
          <p
            key={`${detail.field}-${index}`}
            className="text-[13px] leading-5 text-neutral-600"
          >
            <span className="font-medium text-neutral-700">
              {formatAuditFieldName(detail.field)}:
            </span>{" "}
            {oldValue && newValue
              ? `${oldValue} → ${newValue}`
              : newValue || oldValue || "—"}
          </p>
        );
      })}
    </div>
  );
}

function AuditChange({
  label,
  oldValue,
  newValue,
  oldClassName = "bg-red-50 text-red-700",
  newClassName = "bg-emerald-50 text-emerald-700",
}: {
  label: string;
  oldValue: string;
  newValue: string;
  oldClassName?: string;
  newClassName?: string;
}) {
  return (
    <div className="space-y-1.5 text-[13px] leading-5">
      <p className="text-neutral-600">{label}:</p>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn("rounded-md px-2 py-0.5 text-[11px]", oldClassName)}
        >
          {oldValue}
        </span>

        <span className="text-neutral-500">→</span>

        <span
          className={cn("rounded-md px-2 py-0.5 text-[11px]", newClassName)}
        >
          {newValue}
        </span>
      </div>
    </div>
  );
}

export default function CustomerAuditLogsTab({ customerId }: Props) {
  const [activeTypes, setActiveTypes] =
    useState<AuditLogType[]>(ALL_AUDIT_TYPES);
  const [pageIndex, setPageIndex] = useState(0);

  const { data, isPending, isError, error, isFetching } =
    useCustomerAuditLogsQuery(customerId, {
      page: pageIndex + 1,
      limit: PAGE_SIZE,
    });

  const rows = useMemo<AuditRow[]>(() => {
    return [...(data?.items ?? [])]
      .filter((log) => activeTypes.includes(log.type))
      .sort(
        (a, b) =>
          new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime(),
      )
      .map((log) => {
        const performedAt = new Date(log.performedAt);

        return {
          log,
          dateLabel: DATE_FORMATTER.format(performedAt),
          timeLabel: TIME_FORMATTER.format(performedAt),
        };
      });
  }, [data?.items, activeTypes]);

  const pageInfo = data?.pageInfo;
  const totalPages = pageInfo?.totalPages ?? 1;
  const totalItems = pageInfo?.totalItems ?? 0;

  const from = rows.length > 0 ? pageIndex * PAGE_SIZE + 1 : 0;
  const to = rows.length > 0 ? pageIndex * PAGE_SIZE + rows.length : 0;

  const visiblePages = useMemo(() => {
    if (totalPages <= 0) {
      return [];
    }

    const current = pageIndex + 1;
    const start = Math.max(1, Math.min(current - 1, totalPages - 2));
    const end = Math.min(totalPages, start + 2);

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [pageIndex, totalPages]);

  const toggleType = (type: AuditLogType) => {
    setActiveTypes((prev) => {
      if (prev.includes(type)) {
        if (prev.length === 1) {
          return prev;
        }

        setPageIndex(0);
        return prev.filter((item) => item !== type);
      }

      setPageIndex(0);
      return [...prev, type];
    });
  };

  const resetFilters = () => {
    setActiveTypes(ALL_AUDIT_TYPES);
    setPageIndex(0);
  };

  const goToPage = (pageNumber: number) => {
    if (
      pageNumber < 1 ||
      pageNumber > totalPages ||
      pageNumber === pageIndex + 1
    ) {
      return;
    }

    setPageIndex(pageNumber - 1);
  };

  const goToPreviousPage = () => {
    if (!pageInfo?.hasPreviousPage) {
      return;
    }

    setPageIndex((page) => Math.max(0, page - 1));
  };

  const goToNextPage = () => {
    if (!pageInfo?.hasNextPage) {
      return;
    }

    setPageIndex((page) => page + 1);
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="flex flex-col gap-3 border-b px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h3 className="font-semibold text-[#266699]">Audit Logs</h3>
            <p className="text-sm leading-5 text-neutral-500">
              Complete history of changes and actions performed for this
              customer.
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full gap-2 sm:w-auto"
                type="button"
              >
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Log Types</DropdownMenuLabel>
              <DropdownMenuSeparator />

              {ALL_AUDIT_TYPES.map((type) => (
                <DropdownMenuCheckboxItem
                  key={type}
                  checked={activeTypes.includes(type)}
                  onCheckedChange={() => toggleType(type)}
                >
                  {ACTION_META[type].label}
                </DropdownMenuCheckboxItem>
              ))}

              <DropdownMenuSeparator />

              <Button
                type="button"
                variant="ghost"
                className="h-8 w-full justify-start px-2 text-sm"
                onClick={resetFilters}
              >
                Reset filters
              </Button>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="hidden border-b bg-[#F6F6F6] lg:block">
          <div className="grid grid-cols-[120px_150px_minmax(0,1fr)_160px] text-sm font-semibold text-neutral-700">
            <div className="px-4 py-3 text-center">Date &amp; Time</div>
            <div className="border-l px-4 py-3 text-center">Action</div>
            <div className="border-l px-4 py-3 text-center">Details</div>
            <div className="border-l px-4 py-3 text-center">By</div>
          </div>
        </div>

        <div className="max-h-190 overflow-y-auto">
          {isPending ? (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading audit logs...
            </div>
          ) : isError ? (
            <div className="flex h-40 items-center justify-center px-4 text-center text-sm text-red-600">
              {getErrorMessage(error, "Failed to load audit logs.")}
            </div>
          ) : rows.length > 0 ? (
            <div>
              {rows.map((row) => {
                const meta = ACTION_META[row.log.type];
                const Icon = meta.icon;

                return (
                  <div
                    key={row.log.id}
                    className="border-b p-3 last:border-b-0 sm:p-4 lg:grid lg:grid-cols-[120px_150px_minmax(0,1fr)_160px] lg:p-0"
                  >
                    <div className="flex items-center justify-between gap-3 lg:block lg:px-4 lg:py-4 lg:text-center">
                      <div>
                        <div className="text-[13px] font-semibold text-neutral-700">
                          {row.dateLabel}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {row.timeLabel}
                        </div>
                      </div>

                      <div
                        className={cn(
                          "flex items-center gap-1.5 text-[12px] font-semibold lg:hidden",
                          meta.tone.split(" ")[0],
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </div>
                    </div>

                    <div className="hidden border-l px-4 py-4 lg:block">
                      <div
                        className={cn(
                          "flex items-center justify-center gap-2 text-[13px] font-semibold leading-5",
                          meta.tone,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </div>
                    </div>

                    <div className="mt-3 min-w-0 lg:mt-0 lg:border-l lg:px-4 lg:py-4">
                      <div className="min-w-0">{renderDetails(row.log)}</div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 border-t pt-3 lg:mt-0 lg:block lg:border-l lg:border-t-0 lg:px-4 lg:py-4 lg:text-center">
                      <span className="text-xs text-neutral-500 lg:hidden">
                        By
                      </span>

                      <span className="text-sm font-medium text-neutral-700">
                        {row.log.performedBy.fullName}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center px-4 text-center text-sm text-neutral-500">
              No audit logs found.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-neutral-500">
            Showing {from} to {to} of {totalItems} audit logs
            {isFetching ? " • Updating..." : ""}
          </p>

          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="icon"
              type="button"
              onClick={goToPreviousPage}
              disabled={!pageInfo?.hasPreviousPage}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1">
              {visiblePages.map((pageNumber) => (
                <Button
                  key={pageNumber}
                  type="button"
                  variant={pageIndex + 1 === pageNumber ? "default" : "outline"}
                  className="h-9 w-9 p-0"
                  onClick={() => goToPage(pageNumber)}
                  aria-label={`Go to page ${pageNumber}`}
                >
                  {pageNumber}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="icon"
              type="button"
              onClick={goToNextPage}
              disabled={!pageInfo?.hasNextPage}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-lg border bg-white p-3 sm:p-4">
          <div className="mb-2 text-sm font-semibold text-[#266699]">
            About Audit Logs
          </div>

          <div className="space-y-1 text-sm leading-6 text-neutral-600">
            <p>
              All important changes and actions are recorded for security and
              transparency.
            </p>
            <p>Logs cannot be modified or deleted.</p>
            <p>Use filters to inspect a narrower set of events.</p>
          </div>
        </div>

        <div className="rounded-lg border bg-blue-50 px-3 py-3 text-sm text-neutral-600 sm:px-4">
          <div className="flex items-center gap-2 font-semibold text-[#266699]">
            <Info className="h-5 w-5 shrink-0" />
            Tip
          </div>

          <p className="mt-1">
            This tab reads from the live backend and reflects actual customer
            activity.
          </p>
        </div>
      </div>
    </div>
  );
}
