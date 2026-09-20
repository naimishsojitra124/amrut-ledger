import { useEffect, useMemo, useState } from "react";
import {
  type ColumnDef,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Ban,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  MoreHorizontal,
  PencilLine,
  Plus,
  RefreshCcw,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { QueryErrorState } from "@/components/common/query-error-state";
import { DataTableSkeleton } from "@/components/common/data-table-skeleton";
import FilterSelect from "../common/filter-select";

import {
  useCustomersQuery,
  useRestoreCustomerMutation,
} from "@/services/customer.service";
import { useModalStore } from "@/store/modal.store";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/permissions";
import type { CustomerListItemResponse } from "@/types/customer";
import { formatCurrency } from "@/utils/format-currency";
import { formatDate } from "@/utils/format-date";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { AVATAR_CLASSES } from "../settings/tabs/users-tab";
import { cn } from "@/lib/utils";

type CustomerRow = CustomerListItemResponse;

type StatusFilter = "all" | "active" | "archived";

type OutstandingFilter = "all" | "due" | "clear";

type CustomerTableProps = {
  onViewCustomer?: (customerId: string) => void;
  onEditCustomer?: (customerId: string) => void;
  onCloseCustomer?: (customerId: string) => void;
  onReopenCustomer?: (customerId: string) => void;
  onImportCustomers?: () => void;
  onExportCustomers?: () => void;
  onAddCustomer?: () => void;
};

const PAGE_SIZES = [10, 20, 50];

const EMPTY_CUSTOMERS: CustomerRow[] = [];

const MOBILE_HIDDEN_COLUMNS = new Set([
  "mobileNumber",
  "primaryMilk",
  "lastEntryAt",
]);

function getInitials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getResponsiveColumnClass(columnId: string) {
  return MOBILE_HIDDEN_COLUMNS.has(columnId) ? "hidden sm:table-cell" : "";
}

export default function CustomerTable({
  onViewCustomer,
  onEditCustomer,
  onCloseCustomer,
  onReopenCustomer,
  onAddCustomer,
}: CustomerTableProps) {
  const { can } = usePermissions();
  const canCreateCustomer = can(PERMISSIONS.CUSTOMER_CREATE);

  const [searchText, setSearchText] = useState("");
  const search = useDebouncedValue(searchText);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [milkTypeFilter, setMilkTypeFilter] = useState("all");

  const [outstandingFilter, setOutstandingFilter] =
    useState<OutstandingFilter>("all");

  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const [notesOnly, setNotesOnly] = useState(false);
  const [multiMilkOnly, setMultiMilkOnly] = useState(false);
  const [activeCardOnly, setActiveCardOnly] = useState(false);

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const openCustomerCreate = useModalStore((state) => state.openCustomerCreate);

  const openCustomerEdit = useModalStore((state) => state.openCustomerEdit);

  const openCustomerCloseConfirm = useModalStore(
    (state) => state.openCustomerCloseConfirm,
  );
  const openConfirmation = useModalStore((state) => state.openConfirmation);

  const restoreCustomerMutation = useRestoreCustomerMutation();

  const apiStatus =
    statusFilter === "active"
      ? "active"
      : statusFilter === "archived"
        ? "archived"
        : undefined;

  const { data, isPending, isFetching, isError, error, refetch } =
    useCustomersQuery({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      status: apiStatus,
      search: search.trim() || undefined,
    });

  const customerList = data?.items ?? EMPTY_CUSTOMERS;

  const activeMilkTypes = useMemo(() => {
    const seen = new Map<
      string,
      {
        milkTypeId: string;
        milkTypeName: string;
        shortCode: string;
      }
    >();

    for (const customer of customerList) {
      for (const milkType of customer.milkTypes) {
        if (!seen.has(milkType.milkTypeId)) {
          seen.set(milkType.milkTypeId, {
            milkTypeId: milkType.milkTypeId,
            milkTypeName: milkType.milkTypeName,
            shortCode: milkType.shortCode,
          });
        }
      }
    }

    return Array.from(seen.values());
  }, [customerList]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    return customerList.filter((row) => {
      const primaryMilk = row.milkTypes.find((item) => item.isDefault) ?? null;

      const cardNumber = row.currentCard?.cardNumber
        ? String(row.currentCard.cardNumber)
        : "";

      const milkTypeLabel = primaryMilk?.milkTypeName ?? "";

      const statusLabel = row.status === "active" ? "active" : "archived";

      const hasNotes = Boolean(row.notes?.trim());

      const hasMultipleMilkTypes = row.milkTypes.length > 1;

      const hasActiveCard = Boolean(row.currentCard);

      const searchMatch =
        normalizedSearch.length === 0 ||
        row.fullName.toLowerCase().includes(normalizedSearch) ||
        row.mobileNumber.includes(normalizedSearch) ||
        cardNumber.includes(normalizedSearch) ||
        milkTypeLabel.toLowerCase().includes(normalizedSearch) ||
        statusLabel.includes(normalizedSearch) ||
        String(row.depositAmount).includes(normalizedSearch) ||
        String(row.outstandingAmount).includes(normalizedSearch);

      const milkTypeMatch =
        milkTypeFilter === "all" ||
        primaryMilk?.milkTypeId === milkTypeFilter ||
        row.milkTypes.some((item) => item.milkTypeId === milkTypeFilter);

      const outstandingMatch =
        outstandingFilter === "all" ||
        (outstandingFilter === "due" && row.outstandingAmount > 0) ||
        (outstandingFilter === "clear" && row.outstandingAmount === 0);

      return (
        searchMatch &&
        milkTypeMatch &&
        outstandingMatch &&
        (!notesOnly || hasNotes) &&
        (!multiMilkOnly || hasMultipleMilkTypes) &&
        (!activeCardOnly || hasActiveCard)
      );
    });
  }, [
    customerList,
    normalizedSearch,
    milkTypeFilter,
    outstandingFilter,
    notesOnly,
    multiMilkOnly,
    activeCardOnly,
  ]);

  useEffect(() => {
    setPagination((prev) => {
      if (prev.pageIndex === 0) {
        return prev;
      }

      return {
        ...prev,
        pageIndex: 0,
      };
    });
  }, [
    search,
    statusFilter,
    milkTypeFilter,
    outstandingFilter,
    notesOnly,
    multiMilkOnly,
    activeCardOnly,
  ]);

  function handleResetFilters() {
    setSearchText("");
    setStatusFilter("all");
    setMilkTypeFilter("all");
    setOutstandingFilter("all");
    setNotesOnly(false);
    setMultiMilkOnly(false);
    setActiveCardOnly(false);

    setPagination({
      pageIndex: 0,
      pageSize: pagination.pageSize,
    });
  }

  function handleCloseCustomer(customer: CustomerRow) {
    openCustomerCloseConfirm({
      customerId: customer.id,
      customerName: customer.fullName,
      depositAmount: customer.depositAmount,
      onConfirmed: () => {
        onCloseCustomer?.(customer.id);
      },
    });
  }

  function handleReopenCustomer(customer: CustomerRow) {
    openConfirmation({
      title: `Reopen ${customer.fullName}?`,
      description:
        "This customer will become active again and can be used in normal customer workflows.",
      confirmLabel: "Reopen Customer",
      successMessage: "Customer reopened",
      onConfirm: () =>
        restoreCustomerMutation.mutateAsync(customer.id).then(() => {
          onReopenCustomer?.(customer.id);
        }),
    });
  }

  const columns = useMemo<ColumnDef<CustomerRow>[]>(
    () => [
      {
        accessorKey: "cardNumber",
        header: "Card No.",
        cell: ({ row }) => {
          const cardNumber = row.original.currentCard?.cardNumber;

          return cardNumber ? (
            <button
              type="button"
              onClick={() => onViewCustomer?.(row.original.id)}
              className="font-semibold text-[#266699] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#266699] focus-visible:ring-offset-2"
            >
              {cardNumber}
            </button>
          ) : (
            <span className="text-neutral-400">-</span>
          );
        },
      },
      {
        accessorKey: "fullName",
        header: "Customer Name",
        cell: ({ row }) => {
          const customer = row.original;

          const initials = getInitials(customer.fullName);

          const primaryMilk =
            customer.milkTypes.find((item) => item.isDefault) ?? null;

          const avatarClass =
            AVATAR_CLASSES[
              (pagination.pageIndex * pagination.pageSize + row.index) %
                AVATAR_CLASSES.length
            ];

          return (
            <div className="flex min-w-0 items-center justify-start gap-2 sm:gap-3">
              <Avatar className="h-8 w-8 shrink-0" aria-hidden="true">
                <AvatarFallback
                  className={cn("text-sm font-semibold", avatarClass)}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 text-left">
                <button
                  type="button"
                  onClick={() => onViewCustomer?.(customer.id)}
                  className="block max-w-48 truncate font-medium text-neutral-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#266699] focus-visible:ring-offset-2"
                >
                  {customer.fullName}
                </button>

                <span className="block truncate text-xs text-neutral-500">
                  {primaryMilk ? primaryMilk.milkTypeName : "No milk type"}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "mobileNumber",
        header: "Mobile",
        cell: ({ row }) =>
          row.original.mobileNumber ? (
            <>
              {row.original.mobileNumber.slice(0, 5)}-
              {row.original.mobileNumber.slice(5, 10)}
            </>
          ) : (
            <span className="text-neutral-400">-</span>
          ),
      },
      {
        accessorKey: "primaryMilk",
        header: "Primary Milk",
        cell: ({ row }) => {
          const primaryMilk =
            row.original.milkTypes.find((item) => item.isDefault) ?? null;

          return primaryMilk ? (
            <Badge className="bg-blue-50 text-[#266699] hover:bg-blue-50">
              {primaryMilk.milkTypeName}
            </Badge>
          ) : (
            <span className="text-neutral-400">-</span>
          );
        },
      },
      {
        accessorKey: "depositAmount",
        header: "Deposit (₹)",
        cell: ({ row }) => formatCurrency(row.original.depositAmount),
      },
      {
        accessorKey: "outstandingAmount",
        header: "Outstanding (₹)",
        cell: ({ row }) => {
          const outstanding = row.original.outstandingAmount;

          return (
            <span
              className={
                outstanding > 0
                  ? "font-semibold text-red-500"
                  : "font-semibold text-emerald-600"
              }
            >
              {formatCurrency(outstanding)}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.status;

          return (
            <Badge
              className={
                status === "active"
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-100"
              }
            >
              {status === "active" ? "Active" : "Closed"}
            </Badge>
          );
        },
      },
      {
        accessorKey: "lastEntryAt",
        header: "Last Entry",
        cell: ({ row }) =>
          row.original.lastEntryAt ? formatDate(row.original.lastEntryAt) : "-",
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const customer = row.original;

          const isActive = customer.status === "active";

          const actionPending = restoreCustomerMutation.isPending;

          return (
            <div className="flex items-center justify-end gap-1.5 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onViewCustomer?.(customer.id)}
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
                    aria-label={`More actions for ${customer.fullName}`}
                    className="h-9 w-9"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => {
                      if (onEditCustomer) {
                        onEditCustomer(customer.id);
                        return;
                      }

                      openCustomerEdit(customer.id);
                    }}
                    className="flex items-center gap-2"
                  >
                    <PencilLine className="h-4 w-4" />
                    Edit Customer
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {isActive ? (
                    <DropdownMenuItem
                      disabled={actionPending}
                      onClick={() => void handleCloseCustomer(customer)}
                      className="flex items-center gap-2 text-red-600 focus:text-red-600"
                    >
                      <Ban className="h-4 w-4" />
                      Close Customer
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      disabled={actionPending}
                      onClick={() => handleReopenCustomer(customer)}
                      className="flex items-center gap-2 text-emerald-600 focus:text-emerald-600"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reopen Customer
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [
      onViewCustomer,
      onEditCustomer,
      onCloseCustomer,
      onReopenCustomer,
      openCustomerEdit,
      restoreCustomerMutation.isPending,
      openConfirmation,
      pagination.pageIndex,
      pagination.pageSize,
    ],
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: {
      pagination,
    },
    onPaginationChange: setPagination,
    manualPagination: true,
    pageCount: data?.pageInfo.totalPages ?? -1,
    getCoreRowModel: getCoreRowModel(),
  });

  const currentRows = table.getRowModel().rows;

  const pageInfo = data?.pageInfo;

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

  function openCreateCustomer() {
    if (onAddCustomer) {
      onAddCustomer();
      return;
    }

    openCustomerCreate();
  }

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
              placeholder="Search by card no., name or mobile..."
              aria-label="Search customers"
            />
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <FilterSelect
              label="Status"
              className="w-full min-w-0 sm:w-30"
              triggerClassName="w-full sm:w-30"
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Closed</SelectItem>
            </FilterSelect>

            <FilterSelect
              label="Milk Type"
              className="w-full min-w-0 sm:w-30"
              triggerClassName="w-full sm:w-30"
              value={milkTypeFilter}
              onValueChange={setMilkTypeFilter}
            >
              <SelectItem value="all">All</SelectItem>

              {activeMilkTypes.map((milkType) => (
                <SelectItem
                  key={milkType.milkTypeId}
                  value={milkType.milkTypeId}
                >
                  {milkType.milkTypeName}
                </SelectItem>
              ))}
            </FilterSelect>

            <FilterSelect
              label="Outstanding"
              className="w-full min-w-0 sm:w-30"
              triggerClassName="w-full sm:w-30"
              value={outstandingFilter}
              onValueChange={(value) =>
                setOutstandingFilter(value as OutstandingFilter)
              }
            >
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="due">With Due</SelectItem>
              <SelectItem value="clear">Clear</SelectItem>
            </FilterSelect>

            <Button
              variant="outline"
              type="button"
              onClick={() => setShowMoreFilters((prev) => !prev)}
              size="default"
              aria-expanded={showMoreFilters}
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

            {canCreateCustomer && (
              <Button onClick={openCreateCustomer} type="button" size="default">
                <Plus className="h-4 w-4" />
                <span>Add Customer</span>
              </Button>
            )}
          </div>
        </div>

        {showMoreFilters ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={notesOnly ? "default" : "outline"}
              onClick={() => setNotesOnly((prev) => !prev)}
            >
              Notes only
            </Button>

            <Button
              type="button"
              size="sm"
              variant={multiMilkOnly ? "default" : "outline"}
              onClick={() => setMultiMilkOnly((prev) => !prev)}
            >
              Multi milk customers
            </Button>

            <Button
              type="button"
              size="sm"
              variant={activeCardOnly ? "default" : "outline"}
              onClick={() => setActiveCardOnly((prev) => !prev)}
            >
              Active card only
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
                  No customers found.
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
              Showing {customerList.length} of {pageInfo?.totalItems ?? 0}{" "}
              customers
            </p>

            {isFetching && !isPending ? (
              <span className="shrink-0 text-xs text-neutral-500">
                Updating…
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-end gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous page"
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  pageIndex: Math.max(0, prev.pageIndex - 1),
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
                  setPagination((prev) => ({
                    ...prev,
                    pageIndex: pageNumber - 1,
                  }))
                }
                disabled={isPending}
              >
                {pageNumber}
              </Button>
            ))}

            <Button
              variant="outline"
              size="icon"
              aria-label="Next page"
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  pageIndex: prev.pageIndex + 1,
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
                aria-label="Customers per page"
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
