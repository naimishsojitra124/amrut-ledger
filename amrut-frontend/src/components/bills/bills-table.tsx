import { useEffect, useMemo, useState } from "react";
import {
  type ColumnDef,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  RefreshCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { useBillsQuery } from "@/services/bill.service";
import type { BillListItemResponse, BillStatus } from "@/types/bill";

import { formatCurrency } from "@/utils/format-currency";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import FilterSelect from "../common/filter-select";
import { DataTableSkeleton } from "@/components/common/data-table-skeleton";
import { QueryErrorState } from "@/components/common/query-error-state";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

type BillRow = BillListItemResponse;

type BillsTableProps = {
  onViewBill?: (billId: string) => void;
};

type StatusFilter = "all" | BillStatus;

const PAGE_SIZES = [10, 20, 50];

const EMPTY_BILLS: BillRow[] = [];

const MOBILE_HIDDEN_COLUMNS = new Set([
  "monthYear",
  "totalPaid",
  "outstanding",
]);

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const month = index + 1;

  return {
    value: String(month),
    label: new Date(2000, index).toLocaleDateString("en-IN", {
      month: "long",
    }),
  };
});

function getResponsiveColumnClass(columnId: string) {
  if (columnId === "monthYear") {
    return "hidden sm:table-cell";
  }

  if (columnId === "totalPaid") {
    return "hidden md:table-cell";
  }

  if (columnId === "outstanding") {
    return "hidden lg:table-cell";
  }

  return MOBILE_HIDDEN_COLUMNS.has(columnId) ? "hidden sm:table-cell" : "";
}

function getCurrentMonth() {
  const now = new Date();

  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

function getMonthYearLabel(year: number, month: number) {
  return new Date(year, month - 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function getStatusBadge(status: BillStatus, isOpeningBalance = false) {
  if (isOpeningBalance && status !== "carried_forward") {
    return (
      <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
        Opening Balance
      </Badge>
    );
  }

  switch (status) {
    case "paid":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
          Paid
        </Badge>
      );

    case "partial":
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
          Partially Paid
        </Badge>
      );

    case "carried_forward":
      return (
        <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
          Carried Forward
        </Badge>
      );

    default:
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
          Unpaid
        </Badge>
      );
  }
}

export default function BillsTable({ onViewBill }: BillsTableProps) {
  const [searchText, setSearchText] = useState("");
  const search = useDebouncedValue(searchText);

  const [monthFilter, setMonthFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [currentMonthOnly, setCurrentMonthOnly] = useState(false);
  const [hasOutstandingOnly, setHasOutstandingOnly] = useState(false);

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const currentMonth = useMemo(() => getCurrentMonth(), []);

  const apiMonth = currentMonthOnly
    ? currentMonth.month
    : monthFilter === "all"
      ? undefined
      : Number(monthFilter);

  const apiYear = currentMonthOnly
    ? currentMonth.year
    : yearFilter === "all"
      ? undefined
      : Number(yearFilter);

  const apiStatus = statusFilter === "all" ? undefined : statusFilter;

  const billQuery = useMemo(
    () => ({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      month: apiMonth,
      year: apiYear,
      status: apiStatus,
      search: search.trim() || undefined,
      hasOutstanding: hasOutstandingOnly ? true : undefined,
    }),
    [
      pagination.pageIndex,
      pagination.pageSize,
      apiMonth,
      apiYear,
      apiStatus,
      search,
      hasOutstandingOnly,
    ],
  );

  const { data, isPending, isFetching, isError, error, refetch } =
    useBillsQuery(billQuery);

  const billList = data?.items ?? EMPTY_BILLS;
  const pageInfo = data?.pageInfo;

  const availableYears = useMemo(() => {
    return [...new Set(billList.map((bill) => bill.year))].sort(
      (a, b) => b - a,
    );
  }, [billList]);

  useEffect(() => {
    setPagination((previous) => {
      if (previous.pageIndex === 0) {
        return previous;
      }

      return {
        ...previous,
        pageIndex: 0,
      };
    });
  }, [
    search,
    monthFilter,
    yearFilter,
    statusFilter,
    currentMonthOnly,
    hasOutstandingOnly,
  ]);

  function handleResetFilters() {
    setSearchText("");
    setMonthFilter("all");
    setYearFilter("all");
    setStatusFilter("all");
    setCurrentMonthOnly(false);
    setHasOutstandingOnly(false);

    setPagination({
      pageIndex: 0,
      pageSize: pagination.pageSize,
    });
  }

  const columns = useMemo<ColumnDef<BillRow>[]>(
    () => [
      {
        accessorKey: "billNumber",
        header: "Bill No.",
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => onViewBill?.(row.original.id)}
            className="font-semibold text-[#266699] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#266699] focus-visible:ring-offset-2"
          >
            {row.original.billNumber}
          </button>
        ),
      },
      {
        accessorKey: "customerName",
        header: "Customer Name",
        cell: ({ row }) => {
          const bill = row.original;

          return (
            <div className="min-w-0 text-left">
              <button
                type="button"
                onClick={() => onViewBill?.(bill.id)}
                className="block max-w-56 truncate font-medium text-neutral-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#266699] focus-visible:ring-offset-2"
              >
                {bill.customer.fullName}
              </button>

              <span className="block truncate text-xs text-neutral-500">
                {bill.cardAssignment.cardNumber ?? "-"}
              </span>
            </div>
          );
        },
      },
      {
        id: "monthYear",
        header: "Month / Year",
        cell: ({ row }) =>
          getMonthYearLabel(row.original.year, row.original.month),
      },
      {
        accessorKey: "grandTotal",
        header: "Total Amount",
        cell: ({ row }) => (
          <span className="font-semibold text-neutral-900">
            {formatCurrency(row.original.grandTotal)}
          </span>
        ),
      },
      {
        accessorKey: "totalPaid",
        id: "totalPaid",
        header: "Paid Amount",
        cell: ({ row }) => (
          <span
            className={
              row.original.totalPaid > 0
                ? "font-semibold text-emerald-600"
                : "font-semibold text-neutral-500"
            }
          >
            {formatCurrency(row.original.totalPaid)}
          </span>
        ),
      },
      {
        accessorKey: "outstandingAmount",
        id: "outstanding",
        header: "Outstanding",
        cell: ({ row }) => (
          <span
            className={
              row.original.outstandingAmount > 0
                ? "font-semibold text-red-500"
                : "font-semibold text-emerald-600"
            }
          >
            {formatCurrency(row.original.outstandingAmount)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <div className="flex justify-center">
            {getStatusBadge(row.original.status, row.original.isOpeningBalance)}
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const bill = row.original;

          return (
            <div className="flex items-center justify-end gap-1.5 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onViewBill?.(bill.id)}
                className="gap-1.5 px-2.5 sm:gap-2 sm:px-3"
              >
                <Eye className="h-4 w-4" />
                <span className="hidden sm:inline">View</span>
              </Button>
            </div>
          );
        },
      },
    ],
    [onViewBill],
  );

  const table = useReactTable({
    data: billList,
    columns,
    state: {
      pagination,
    },
    onPaginationChange: setPagination,
    manualPagination: true,
    pageCount: pageInfo?.totalPages ?? -1,
    getCoreRowModel: getCoreRowModel(),
  });

  const currentRows = table.getRowModel().rows;

  const visiblePages = useMemo(() => {
    if (!pageInfo) {
      return [];
    }

    const current = pageInfo.page;

    const start = Math.max(
      1,
      Math.min(current - 1, Math.max(1, pageInfo.totalPages - 2)),
    );

    const end = Math.min(pageInfo.totalPages, start + 2);

    return Array.from(
      {
        length: end - start + 1,
      },
      (_, index) => start + index,
    );
  }, [pageInfo]);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm sm:rounded-2xl">
      <div className="shrink-0 border-b p-3 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_auto] lg:items-end">
          <div className="relative min-w-0">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500 sm:right-4 sm:h-5 sm:w-5"
            />

            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search customer or bill no..."
              aria-label="Search bills"
            />
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <FilterSelect
              label="Month"
              className="w-full min-w-0 sm:w-30"
              triggerClassName="w-full sm:w-30"
              value={monthFilter}
              onValueChange={setMonthFilter}
            >
              <SelectItem value="all">All Months</SelectItem>

              {MONTH_OPTIONS.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </FilterSelect>

            <FilterSelect
              label="Year"
              className="w-full min-w-0 sm:w-30"
              triggerClassName="w-full sm:w-30"
              value={yearFilter}
              onValueChange={setYearFilter}
            >
              <SelectItem value="all">All Years</SelectItem>

              {availableYears.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </FilterSelect>

            <FilterSelect
              label="Status"
              className="w-full min-w-0 sm:w-30"
              triggerClassName="w-full sm:w-30"
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="carried_forward">Carried Forward</SelectItem>
            </FilterSelect>

            <Button
              variant="outline"
              type="button"
              onClick={() => setShowMoreFilters((previous) => !previous)}
              aria-expanded={showMoreFilters}
              size="default"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">More Filters</span>

              {showMoreFilters ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              type="button"
              onClick={handleResetFilters}
              size="default"
            >
              <RefreshCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          </div>
        </div>

        {showMoreFilters ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={currentMonthOnly ? "default" : "outline"}
              onClick={() => setCurrentMonthOnly((previous) => !previous)}
            >
              Current month only
            </Button>

            <Button
              type="button"
              size="sm"
              variant={hasOutstandingOnly ? "default" : "outline"}
              onClick={() => setHasOutstandingOnly((previous) => !previous)}
            >
              Bills with outstanding
            </Button>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <Table className="min-w-160 sm:min-w-225">
          <TableHeader className="bg-[#F6F6F6]">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={`${getResponsiveColumnClass(header.column.id)} ${
                      header.column.id === "actions"
                        ? "text-right"
                        : "text-center"
                    }`}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {isPending ? (
              <DataTableSkeleton columns={columns.length} rows={6} />
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-0">
                  <QueryErrorState
                    error={error}
                    onRetry={() => void refetch()}
                  />
                </TableCell>
              </TableRow>
            ) : currentRows.length ? (
              currentRows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={`${getResponsiveColumnClass(cell.column.id)} ${
                        cell.column.id === "actions" ? "" : "text-center"
                      }`}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-sm text-neutral-500"
                >
                  No bills found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="shrink-0 border-t px-3 py-3 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="truncate text-sm text-neutral-500">
              Showing {billList.length} of {pageInfo?.totalItems ?? 0} bills
            </p>

            {isFetching && !isPending ? (
              <span className="shrink-0 text-xs text-neutral-500">
                Updating…
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 md:justify-end">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Previous page"
              onClick={() =>
                setPagination((previous) => ({
                  ...previous,
                  pageIndex: Math.max(0, previous.pageIndex - 1),
                }))
              }
              disabled={!pageInfo?.hasPreviousPage || isPending}
              className="h-9 w-9"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {visiblePages.map((pageNumber) => (
              <Button
                key={pageNumber}
                type="button"
                variant={
                  pagination.pageIndex + 1 === pageNumber
                    ? "default"
                    : "outline"
                }
                className="h-9 w-9 p-0"
                onClick={() =>
                  setPagination((previous) => ({
                    ...previous,
                    pageIndex: pageNumber - 1,
                  }))
                }
                disabled={isPending}
              >
                {pageNumber}
              </Button>
            ))}

            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Next page"
              onClick={() =>
                setPagination((previous) => ({
                  ...previous,
                  pageIndex: previous.pageIndex + 1,
                }))
              }
              disabled={!pageInfo?.hasNextPage || isPending}
              className="h-9 w-9"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Select
              value={String(pagination.pageSize)}
              onValueChange={(value) =>
                setPagination({
                  pageIndex: 0,
                  pageSize: Number(value),
                })
              }
            >
              <SelectTrigger className="h-9 w-23" aria-label="Bills per page">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
