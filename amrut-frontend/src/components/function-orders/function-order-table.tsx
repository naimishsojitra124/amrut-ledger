import { useEffect, useMemo, useState } from "react";

import {
  type ColumnDef,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  MoreHorizontal,
  RefreshCcw,
  Search,
  Trash2,
} from "lucide-react";

import {
  useDeleteFunctionOrderMutation,
  useFunctionOrdersQuery,
} from "@/services/function-order.service";

import type {
  FunctionOrderListItemsResponse,
  FunctionOrderStatus,
} from "@/types/function-order";

import { formatCurrency } from "@/utils/format-currency";
import { formatDate } from "@/utils/format-date";
import { generateFunctionOrderPdf } from "@/utils/generate-function-order-pdf";

import { QueryErrorState } from "@/components/common/query-error-state";
import { DataTableSkeleton } from "@/components/common/data-table-skeleton";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useModalStore } from "@/store/modal.store";

type FunctionOrderRow = FunctionOrderListItemsResponse;

interface FunctionOrderTableProps {
  onViewFunctionOrder?: (order: FunctionOrderRow) => void;
}

type StatusFilter = "all" | FunctionOrderStatus;

const PAGE_SIZES = [10, 20, 50] as const;

const EMPTY_ORDERS: FunctionOrderRow[] = [];

const MOBILE_HIDDEN_COLUMNS = new Set(["mobileNumber", "deliveryDays"]);

function getResponsiveColumnClass(columnId: string) {
  if (columnId === "mobileNumber") {
    return "hidden sm:table-cell";
  }

  if (columnId === "deliveryDays") {
    return "hidden lg:table-cell";
  }

  return MOBILE_HIDDEN_COLUMNS.has(columnId) ? "hidden sm:table-cell" : "";
}

export function getStatusLabel(status: FunctionOrderStatus) {
  switch (status) {
    case "confirmed":
      return "Confirmed";

    case "completed":
      return "Completed";

    case "cancelled":
      return "Cancelled";

    default:
      return status;
  }
}

export function getStatusClassName(status: FunctionOrderStatus) {
  switch (status) {
    case "confirmed":
      return "bg-blue-100 text-blue-700 hover:bg-blue-100";

    case "completed":
      return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";

    case "cancelled":
      return "bg-red-100 text-red-700 hover:bg-red-100";

    case "draft":
    default:
      return "bg-neutral-100 text-neutral-600 hover:bg-neutral-100";
  }
}

export function getOrderTotal(order: FunctionOrderRow) {
  let total = 0;

  for (const day of order.deliveryDays) {
    for (const item of day.items) {
      let dispatchQuantity = 0;
      let returnMovementQuantity = 0;

      for (const movement of item.movements) {
        if (movement.type === "dispatch") {
          dispatchQuantity += movement.quantity;
        } else if (movement.type === "return") {
          returnMovementQuantity += movement.quantity;
        }
      }

      const effectiveQuantity = Math.max(
        item.quantity +
          dispatchQuantity -
          item.returnedQuantity -
          returnMovementQuantity,
        0,
      );

      total += effectiveQuantity * item.unitPrice;
    }
  }

  return total;
}

export default function FunctionOrderTable({
  onViewFunctionOrder,
}: FunctionOrderTableProps) {
  const [searchText, setSearchText] = useState("");

  const search = useDebouncedValue(searchText);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const openFunctionOrderDeleteConfirm = useModalStore(
    (state) => state.openFunctionOrderDeleteConfirm,
  );

  const apiStatus = statusFilter === "all" ? undefined : statusFilter;

  const query = useMemo(
    () => ({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      status: apiStatus,
      search: search.trim() || undefined,
    }),
    [pagination.pageIndex, pagination.pageSize, apiStatus, search],
  );

  const { data, isPending, isFetching, isError, error, refetch } =
    useFunctionOrdersQuery(query);

  const deleteMutation = useDeleteFunctionOrderMutation();

  const orderList = data?.items ?? EMPTY_ORDERS;

  const pageInfo = data?.pageInfo;

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
  }, [search, statusFilter]);

  function handleDeleteOrder(order: FunctionOrderRow) {
    openFunctionOrderDeleteConfirm({
      orderId: order.id,

      orderNumber: order.orderNumber,

      onConfirmed: () => {
        if (orderList.length === 1 && pagination.pageIndex > 0) {
          setPagination((previous) => ({
            ...previous,
            pageIndex: previous.pageIndex - 1,
          }));
        }
      },
    });
  }

  const columns = useMemo<ColumnDef<FunctionOrderRow>[]>(
    () => [
      {
        accessorKey: "orderNumber",
        header: "Order No.",
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => onViewFunctionOrder?.(row.original)}
            className="font-semibold text-[#266699] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#266699] focus-visible:ring-offset-2"
          >
            {row.original.orderNumber}
          </button>
        ),
      },

      {
        accessorKey: "customerName",
        header: "Customer Name",
        cell: ({ row }) => {
          const order = row.original;

          return (
            <div className="min-w-0 text-left">
              <button
                type="button"
                onClick={() => onViewFunctionOrder?.(order)}
                className="block max-w-56 truncate font-medium text-neutral-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#266699] focus-visible:ring-offset-2"
              >
                {order.customerName}
              </button>

              <span className="block truncate text-xs text-neutral-500">
                {order.eventName || "No event name"}
              </span>
            </div>
          );
        },
      },

      {
        accessorKey: "mobileNumber",
        header: "Mobile",
        cell: ({ row }) => {
          const mobile = row.original.mobileNumber;

          if (!mobile) {
            return <span className="text-neutral-400">-</span>;
          }

          return mobile.length === 10
            ? `${mobile.slice(0, 5)}-${mobile.slice(5)}`
            : mobile;
        },
      },

      {
        id: "functionDate",
        header: "Function Date",
        cell: ({ row }) => {
          const firstDay = row.original.deliveryDays[0];

          if (!firstDay) {
            return <span className="text-neutral-400">-</span>;
          }

          return (
            <div>
              <span className="block whitespace-nowrap">
                {formatDate(firstDay.deliveryDate)}
              </span>

              {firstDay.deliveryTime ? (
                <span className="block text-xs text-neutral-500">
                  {firstDay.deliveryTime}
                </span>
              ) : null}
            </div>
          );
        },
      },

      {
        id: "deliveryDays",
        header: "Days",
        cell: ({ row }) => {
          const count = row.original.deliveryDays.length;

          return (
            <div className="flex justify-center">
              <Badge className="bg-blue-50 text-[#266699] hover:bg-blue-50">
                {count} {count === 1 ? "day" : "days"}
              </Badge>
            </div>
          );
        },
      },

      {
        id: "amount",
        header: "Amount (₹)",
        cell: ({ row }) => formatCurrency(getOrderTotal(row.original)),
      },

      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <div className="flex justify-center">
            <Badge className={getStatusClassName(row.original.status)}>
              {getStatusLabel(row.original.status)}
            </Badge>
          </div>
        ),
      },

      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const order = row.original;

          return (
            <div className="flex items-center justify-center gap-1.5 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onViewFunctionOrder?.(order)}
                className="gap-1.5 px-2.5 sm:gap-2 sm:px-3"
              >
                <Eye className="h-4 w-4" />

                <span className="hidden sm:inline">View</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`More actions for ${order.orderNumber}`}
                    className="h-9 w-9"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => generateFunctionOrderPdf(order)}
                    className="flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Generate PDF
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    disabled={deleteMutation.isPending}
                    onClick={() => void handleDeleteOrder(order)}
                    className="flex items-center gap-2 text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Order
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [deleteMutation.isPending, onViewFunctionOrder],
  );

  const table = useReactTable({
    data: orderList,
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
    if (!pageInfo || pageInfo.totalPages <= 0) {
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

  function handleResetFilters() {
    setSearchText("");
    setStatusFilter("all");

    setPagination({
      pageIndex: 0,
      pageSize: pagination.pageSize,
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-white shadow-sm sm:rounded-2xl">
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
              placeholder="Search order, customer or mobile..."
              aria-label="Search function orders"
            />
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <SelectTrigger
                className="w-full sm:w-32"
                aria-label="Filter function orders by status"
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

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
                  No function orders found.
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
              Showing {orderList.length} of {pageInfo?.totalItems ?? 0} function
              orders
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
              <SelectTrigger
                className="h-9 w-23"
                aria-label="Function orders per page"
              >
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
