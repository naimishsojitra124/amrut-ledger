import { useEffect, useState } from "react";
import {
  ArrowRight,
  CircleOff,
  PencilLine,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { ActionTooltip } from "@/components/common/action-tooltip";
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

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useArchiveMilkTypeMutation,
  useMilkTypesQuery,
  useRestoreMilkTypeMutation,
} from "@/hooks/use-milk-types";
import type { MilkType } from "@/services/milk-type.service";
import { useModalStore } from "@/store/modal.store";

type StatusFilter = "all" | "active" | "inactive";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function getShortCode(milkType: MilkType) {
  if (milkType.shortCode?.trim()) {
    return milkType.shortCode.trim().toUpperCase();
  }

  if (!milkType.name?.trim()) {
    return "";
  }

  return milkType.name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 8)
    .toUpperCase();
}

function renderPaginationItems(currentPage: number, pageCount: number) {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const items: Array<number | "..."> = [1];

  if (currentPage > 3) {
    items.push("...");
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(pageCount - 1, currentPage + 1);

  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }

  if (currentPage < pageCount - 2) {
    items.push("...");
  }

  items.push(pageCount);

  return items;
}

export default function MilkTypesTab() {
  const { openMilkTypeForm, openConfirmation } = useModalStore();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);

  const query = useMilkTypesQuery({
    page: pageIndex + 1,
    limit: pageSize,
    search: debouncedSearch.trim() || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const archiveMilkTypeMutation = useArchiveMilkTypeMutation();
  const restoreMilkTypeMutation = useRestoreMilkTypeMutation();

  const milkTypes = query.data?.items ?? [];
  const pageInfo = query.data?.pageInfo;
  const totalItems = pageInfo?.totalItems ?? 0;
  const totalPages = Math.max(1, pageInfo?.totalPages ?? 1);

  const currentPageIndex = Math.min(pageIndex, totalPages - 1);

  const from = totalItems === 0 ? 0 : currentPageIndex * pageSize + 1;
  const to = Math.min(totalItems, (currentPageIndex + 1) * pageSize);

  useEffect(() => {
    setPageIndex(0);
  }, [debouncedSearch, statusFilter, pageSize]);

  useEffect(() => {
    if (pageIndex > totalPages - 1) {
      setPageIndex(Math.max(0, totalPages - 1));
    }
  }, [pageIndex, totalPages]);

  function handleSelectMilkType(milkType: MilkType) {
    openMilkTypeForm(milkType._id);
  }

  function handleAddMilkType() {
    openMilkTypeForm();
  }

  function goToPage(nextPageIndex: number) {
    setPageIndex(Math.min(Math.max(nextPageIndex, 0), totalPages - 1));
  }

  function handleToggleStatus(milkType: MilkType) {
    const isActive = milkType.status === "active";

    openConfirmation({
      title: `${isActive ? "Deactivate" : "Activate"} ${milkType.name}?`,
      description: isActive
        ? "This milk type will no longer be available for new customer selections or entries. You can activate it again later."
        : "This milk type will become available again for active customer workflows.",
      confirmLabel: isActive ? "Deactivate" : "Activate",
      variant: isActive ? "destructive" : "default",
      successMessage: `${milkType.name} ${isActive ? "deactivated" : "activated"}`,
      onConfirm: () =>
        isActive
          ? archiveMilkTypeMutation.mutateAsync(milkType._id).then(() => undefined)
          : restoreMilkTypeMutation.mutateAsync(milkType._id).then(() => undefined),
    });
  }

  const isMutating =
    archiveMilkTypeMutation.isPending || restoreMilkTypeMutation.isPending;

  return (
    <div className="space-y-4 rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold text-neutral-900">
            Milk Types
          </h3>
          <p className="text-xs text-neutral-500">
            Manage all milk types and their rates.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
          <div className="relative min-w-0">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500 sm:right-4 sm:h-5 sm:w-5"
            />

            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search milk types"
              aria-label="Search Milk Types"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger className="h-10 w-full rounded-md sm:w-36">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>

            <SelectContent position="popper">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Button type="button" onClick={handleAddMilkType} size="default">
            <Plus className="h-4 w-4" />
            Add Milk Type
          </Button>
        </div>
      </div>

      <div className="px-3 pb-4 sm:px-4">
        <div className="overflow-hidden rounded-xl border">
          <div className="w-full overflow-x-auto">
            <Table className="min-w-190">
              <TableHeader className="bg-[#F6F6F6]">
                <TableRow>
                  <TableHead className="p-3 text-center">Milk Type</TableHead>
                  <TableHead className="p-3 text-center">
                    Rate (₹/Ltr)
                  </TableHead>
                  <TableHead className="p-3 text-center">Short Code</TableHead>
                  <TableHead className="p-3 text-center">Status</TableHead>
                  <TableHead className="p-3 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {query.isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-28 text-center text-neutral-500"
                    >
                      Loading milk types...
                    </TableCell>
                  </TableRow>
                ) : query.isError ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-28 text-center text-red-600"
                    >
                      {(query.error as Error)?.message ||
                        "Failed to load milk types."}
                    </TableCell>
                  </TableRow>
                ) : milkTypes.length > 0 ? (
                  milkTypes.map((milkType) => (
                    <TableRow
                      key={milkType._id}
                      className="cursor-pointer transition-colors hover:bg-neutral-50"
                      onClick={() => handleSelectMilkType(milkType)}
                    >
                      <TableCell className="p-3 text-center font-medium text-neutral-900">
                        {milkType.name}
                      </TableCell>

                      <TableCell className="p-3 text-center text-neutral-700">
                        {Number(milkType.rate).toFixed(2)}
                      </TableCell>

                      <TableCell className="p-3 text-center font-medium text-neutral-700">
                        {getShortCode(milkType)}
                      </TableCell>

                      <TableCell className="p-3 text-center">
                        <Badge
                          className={
                            milkType.status === "active"
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-100"
                          }
                        >
                          {milkType.status === "active" ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>

                      <TableCell
                        className="p-3 text-center"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <ActionTooltip
                            label="Edit"
                            align="center"
                            side="bottom"
                          >
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => handleSelectMilkType(milkType)}
                            >
                              <PencilLine className="h-4 w-4" />
                            </Button>
                          </ActionTooltip>

                          <ActionTooltip
                            label={
                              milkType.status === "active"
                                ? "Deactivate"
                                : "Activate"
                            }
                            align="center"
                            side="bottom"
                          >
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={isMutating}
                              className={
                                milkType.status === "active"
                                  ? "h-9 w-9 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                  : "h-9 w-9 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                              }
                              onClick={() => void handleToggleStatus(milkType)}
                            >
                              {milkType.status === "active" ? (
                                <CircleOff className="h-4 w-4" />
                              ) : (
                                <RotateCcw className="h-4 w-4" />
                              )}
                            </Button>
                          </ActionTooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-28 text-center text-neutral-500"
                    >
                      No milk types found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 border-t p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-neutral-500">
              Showing {from} to {to} of {totalItems} milk types
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => goToPage(currentPageIndex - 1)}
                disabled={currentPageIndex === 0 || query.isFetching}
              >
                <span className="text-lg leading-none">‹</span>
              </Button>

              {renderPaginationItems(currentPageIndex + 1, totalPages).map(
                (item, index) =>
                  item === "..." ? (
                    <span
                      key={`ellipsis-${index}`}
                      className="px-1 text-sm text-neutral-500 sm:px-2"
                    >
                      ...
                    </span>
                  ) : (
                    <Button
                      key={item}
                      type="button"
                      variant={
                        currentPageIndex + 1 === item ? "default" : "outline"
                      }
                      className="h-9 w-9 p-0"
                      onClick={() => goToPage(item - 1)}
                      disabled={query.isFetching}
                    >
                      {item}
                    </Button>
                  ),
              )}

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => goToPage(currentPageIndex + 1)}
                disabled={
                  currentPageIndex >= totalPages - 1 || query.isFetching
                }
              >
                <span className="text-lg leading-none">›</span>
              </Button>

              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(
                    Number(value) as (typeof PAGE_SIZE_OPTIONS)[number],
                  );
                }}
              >
                <SelectTrigger className="h-9 w-28">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option} / page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 border-t px-3 py-4 sm:px-4 xl:grid-cols-2">
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center gap-2 font-semibold text-neutral-900">
            <ShieldCheck className="h-4 w-4 text-[#266699]" />
            About Milk Types
          </div>

          <div className="mt-3 space-y-2 text-sm text-neutral-600">
            <p>Milk types are used for daily entries and bill calculations.</p>
            <p>Inactive types are hidden from customer selection lists.</p>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center gap-2 font-semibold text-neutral-900">
            <Sparkles className="h-4 w-4 text-[#266699]" />
            Quick Actions
          </div>

          <div className="mt-4 space-y-3">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left text-sm transition hover:bg-neutral-50"
            >
              <div className="min-w-0">
                <p className="font-medium text-neutral-900">
                  Reorder Milk Types
                </p>
                <p className="text-xs text-neutral-500">
                  Change order in selection lists.
                </p>
              </div>

              <ArrowRight className="h-4 w-4 shrink-0 text-neutral-400" />
            </button>

            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left text-sm transition hover:bg-neutral-50"
            >
              <div className="min-w-0">
                <p className="font-medium text-neutral-900">
                  Export Milk Types
                </p>
                <p className="text-xs text-neutral-500">
                  Download the list as a file.
                </p>
              </div>

              <ArrowRight className="h-4 w-4 shrink-0 text-neutral-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
