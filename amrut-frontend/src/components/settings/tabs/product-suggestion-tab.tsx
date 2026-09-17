import { useEffect, useMemo, useState } from "react";
import {
  CircleOff,
  GripVertical,
  PencilLine,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";

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

import { cn } from "@/lib/utils";
import FilterSelect from "@/components/common/filter-select";
import { ActionTooltip } from "@/components/common/action-tooltip";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useActiveProductSuggestionsQuery,
  useArchiveProductSuggestionMutation,
  useCreateProductSuggestionMutation,
  useProductSuggestionsQuery,
  useReorderProductSuggestionsMutation,
  useRestoreProductSuggestionMutation,
  useUpdateProductSuggestionMutation,
  type ProductSuggestion,
} from "@/services/product-suggestion.service";
import { toast } from "sonner";
import { useModalStore } from "@/store/modal.store";

type StatusFilter = "all" | "active" | "inactive";
type Mode = "create" | "edit";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const EMPTY_PRODUCTS: ProductSuggestion[] = [];

function getProductEmoji(name: string) {
  const normalized = name.toLowerCase().trim();

  const emojiMap: Record<string, string> = {
    bread: "🍞",
    butter: "🧈",
    cheese: "🧀",
    "cheese cube": "🧀",
    toast: "🍞",
    chocolate: "🍫",
    biscuit: "🍪",
    buttermilk: "🥛",
    paneer: "🧀",
    khari: "🥨",
    rusk: "🍪",
    wafer: "🍫",
    "cold drink": "🥤",
    "ice cream": "🍨",
    curd: "🥛",
    lassi: "🥤",
    milkshake: "🥤",
    "sweet corn": "🌽",
    namkeen: "🥜",
    cookies: "🍪",
    ghee: "🧈",
    eggs: "🥚",
    juice: "🧃",
  };

  return emojiMap[normalized] ?? "🏷️";
}

function sortByDisplayOrder(items: ProductSuggestion[]) {
  return [...items].sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) {
      return a.displayOrder - b.displayOrder;
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function moveProduct(
  items: ProductSuggestion[],
  draggedId: string,
  targetId: string,
) {
  const fromIndex = items.findIndex((item) => item.id === draggedId);
  const toIndex = items.findIndex((item) => item.id === targetId);

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);

  next.splice(toIndex, 0, moved);

  return next.map((item, index) => ({
    ...item,
    displayOrder: index,
  }));
}

function getStatusBadgeClass(status: ProductSuggestion["status"]) {
  return status === "active"
    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-100";
}

function renderPaginationItems(currentPage: number, pageCount: number) {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const items: Array<number | "..."> = [1];

  if (currentPage > 3) items.push("...");

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(pageCount - 1, currentPage + 1);

  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }

  if (currentPage < pageCount - 2) items.push("...");

  items.push(pageCount);

  return items;
}

export default function ProductSuggestionTab() {
  const { openProductSuggestionForm, openConfirmation } = useModalStore();
  const [searchText, setSearchText] = useState("");
  const searchQuery = useDebouncedValue(searchText);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);

  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [dragOverProductId, setDragOverProductId] = useState<string | null>(
    null,
  );
  const [showAllPreview, setShowAllPreview] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );
  const [mode, setMode] = useState<Mode>("edit");

  const [draftName, setDraftName] = useState("");
  const [draftDisplayOrder, setDraftDisplayOrder] = useState("");
  const [draftStatus, setDraftStatus] = useState<StatusFilter>("active");

  const query = useProductSuggestionsQuery({
    page: pageIndex + 1,
    limit: pageSize,
    search: searchQuery.trim() || undefined,
  });

  const activePreviewQuery = useActiveProductSuggestionsQuery();

  const createMutation = useCreateProductSuggestionMutation();
  const updateMutation = useUpdateProductSuggestionMutation();
  const archiveMutation = useArchiveProductSuggestionMutation();
  const restoreMutation = useRestoreProductSuggestionMutation();
  const reorderMutation = useReorderProductSuggestionsMutation();

  const products = query.data?.items ?? EMPTY_PRODUCTS;
  const pageInfo = query.data?.pageInfo;
  const totalPages = pageInfo?.totalPages ?? 1;
  const totalItems = pageInfo?.totalItems ?? 0;

  const visibleProducts = useMemo(() => {
    return products.filter((item) => {
      if (statusFilter === "all") return true;
      return item.status === statusFilter;
    });
  }, [products, statusFilter]);

  const selectedProduct = useMemo(() => {
    if (mode === "create") return null;
    if (selectedProductId) {
      return (
        visibleProducts.find((item) => item.id === selectedProductId) ?? null
      );
    }
    return visibleProducts[0] ?? null;
  }, [mode, visibleProducts, selectedProductId]);

  useEffect(() => {
    if (mode === "create") return;

    if (visibleProducts.length === 0) {
      setSelectedProductId(null);
      return;
    }

    const exists = selectedProductId
      ? visibleProducts.some((item) => item.id === selectedProductId)
      : false;

    if (!selectedProductId || !exists) {
      setSelectedProductId(visibleProducts[0].id);
    }
  }, [visibleProducts, mode, selectedProductId]);

  useEffect(() => {
    if (mode === "create") return;
    if (!selectedProduct) return;

    setDraftName(selectedProduct.name);
    setDraftDisplayOrder(String(selectedProduct.displayOrder + 1));
    setDraftStatus(selectedProduct.status);
  }, [mode, selectedProduct]);

  const currentPageIndex = Math.min(pageIndex, totalPages - 1);

  const previewProducts = useMemo(() => {
    const items = sortByDisplayOrder(activePreviewQuery.data?.items ?? []);
    return (showAllPreview ? items : items.slice(0, 15)).map((item) => ({
      ...item,
      emoji: getProductEmoji(item.name),
    }));
  }, [activePreviewQuery.data?.items, showAllPreview]);

  const from = totalItems === 0 ? 0 : currentPageIndex * pageSize + 1;
  const to = Math.min(totalItems, (currentPageIndex + 1) * pageSize);

  function handleAddProduct() {
    openProductSuggestionForm();
    return;
    setMode("create");
    setSelectedProductId(null);
    setDraftName("");
    setDraftDisplayOrder("");
    setDraftStatus("active");
  }

  function handleEditProduct(productId: string) {
    openProductSuggestionForm(productId);
    return;
    setMode("edit");
    setSelectedProductId(productId);
  }

  async function handleSubmit() {
    const name = draftName.trim();
    const displayOrder =
      draftDisplayOrder.trim() === ""
        ? undefined
        : Number(draftDisplayOrder) - 1;

    if (
      !name ||
      (displayOrder !== undefined &&
        (Number.isNaN(displayOrder) || displayOrder < 0))
    ) {
      return;
    }

    try {
      if (mode === "create") {
        const created = await createMutation.mutateAsync({
          name,
          displayOrder,
        });
        toast.success("Product suggestion created");
        setMode("edit");
        setSelectedProductId(created.id);
        return;
      }

      if (!selectedProduct) return;

      const updated = await updateMutation.mutateAsync({
        id: selectedProduct.id,
        payload: {
          name,
          displayOrder,
        },
      });

      toast.success("Product suggestion updated");
      setSelectedProductId(updated.id);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save product suggestion",
      );
    }
  }

  function handleToggleProductStatus(productId: string, status: "active" | "inactive") {
    const isActive = status === "active";

    openConfirmation({
      title: `${isActive ? "Deactivate" : "Activate"} product suggestion?`,
      description: isActive
        ? "This product suggestion will no longer appear as an active Quick Entry tag. You can activate it again later."
        : "This product suggestion will become available again as an active Quick Entry tag.",
      confirmLabel: isActive ? "Deactivate" : "Activate",
      variant: isActive ? "destructive" : "default",
      successMessage: `Product suggestion ${isActive ? "deactivated" : "activated"}`,
      onConfirm: () =>
        isActive
          ? archiveMutation.mutateAsync(productId).then(() => undefined)
          : restoreMutation.mutateAsync(productId).then(() => undefined),
    });
  }

  async function handleDrop(targetId: string) {
    if (!draggedProductId || draggedProductId === targetId) {
      setDraggedProductId(null);
      setDragOverProductId(null);
      return;
    }

    const next = moveProduct(visibleProducts, draggedProductId, targetId);

    setDraggedProductId(null);
    setDragOverProductId(null);

    try {
      await reorderMutation.mutateAsync({
        orderedIds: next.map((item) => item.id),
      });
      toast.success("Product order updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reorder products",
      );
    }
  }

  function goToPage(nextPageIndex: number) {
    setPageIndex(Math.min(Math.max(nextPageIndex, 0), totalPages - 1));
  }

  const isBusy =
    createMutation.isPending ||
    updateMutation.isPending ||
    archiveMutation.isPending ||
    restoreMutation.isPending ||
    reorderMutation.isPending;

  return (
    <div className="space-y-2 rounded-2xl border bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold text-neutral-900">
            Product Suggestions
          </h3>
          <p className="max-w-2xl text-xs text-neutral-500">
            Manage product suggestions that appear as quick tags in Quick Entry
            for faster name typing.
          </p>
        </div>

        <Button
          type="button"
          size="default"
          onClick={handleAddProduct}
        >
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end p-2">
        <div className="w-full lg:w-80 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />

          <Input
            value={searchText}
            onChange={(event) => {
              setSearchText(event.target.value);
              setPageIndex(0);
            }}
            placeholder="Search product name..."
            className="pl-10 rounded-md"
          />
        </div>

        {/* Status Filter */}
        <FilterSelect
          label="Status"
          className="w-full"
          triggerClassName="w-full"
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as StatusFilter);
            setPageIndex(0);
          }}
        >
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </FilterSelect>
      </div>

      {/* Quick Entry Preview */}
      <div className="flex flex-col items-start justify-center gap-4 border-y p-4">
        <div className="flex flex-col gap-0.5">
          <h4 className="text-sm font-semibold text-neutral-900">
            Quick Entry Preview{" "}
            <span className="font-medium text-neutral-500">
              ({showAllPreview ? "All Active" : "First 15"})
            </span>
          </h4>

          <p className="mt-1 text-xs text-neutral-500">
            These are the quick tags used in Quick Entry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {previewProducts.map((product) => (
            <button
              key={product.id}
              type="button"
              className="flex items-center gap-2 rounded-md border bg-[#F6F8FF] px-3 py-2 text-sm font-medium text-[#266699] transition hover:bg-blue-50"
              title={product.name}
            >
              <span className="text-sm">{product.emoji}</span>
              <span>{product.name}</span>
            </button>
          ))}

          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => setShowAllPreview((prev) => !prev)}
          >
            {showAllPreview ? "...Show Less" : "Show More..."}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="px-4 py-1 p-4">
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader className="bg-[#F6F6F6]">
              <TableRow>
                <TableHead className="p-3 text-center">#</TableHead>
                <TableHead className="p-3 text-start">Product Name</TableHead>
                <TableHead className="p-3 text-center">Display Order</TableHead>
                <TableHead className="p-3 text-center">Status</TableHead>
                <TableHead className="p-3 text-center">Created On</TableHead>
                <TableHead className="p-3 text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {query.isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-28 text-center text-neutral-500"
                  >
                    Loading product suggestions...
                  </TableCell>
                </TableRow>
              ) : query.isError ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-28 text-center text-red-600"
                  >
                    {(query.error as Error)?.message ||
                      "Failed to load product suggestions."}
                  </TableCell>
                </TableRow>
              ) : visibleProducts.length > 0 ? (
                visibleProducts.map((product, index) => {
                  const rowNumber = currentPageIndex * pageSize + index + 1;
                  const isDragging = draggedProductId === product.id;
                  const isDragTarget = dragOverProductId === product.id;

                  return (
                    <TableRow
                      key={product.id}
                      draggable
                      onDragStart={() => setDraggedProductId(product.id)}
                      onDragEnd={() => {
                        setDraggedProductId(null);
                        setDragOverProductId(null);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragOverProductId(product.id);
                      }}
                      onDrop={() => void handleDrop(product.id)}
                      className={cn(
                        "cursor-grab transition-colors active:cursor-grabbing",
                        isDragging && "opacity-50",
                        isDragTarget && "bg-blue-50/50",
                      )}
                    >
                      <TableCell className="p-3 text-sm text-center text-neutral-700">
                        {rowNumber}
                      </TableCell>

                      <TableCell className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-lg">
                            {getProductEmoji(product.name)}
                          </div>

                          <p className="font-medium text-neutral-900">
                            {product.name}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="p-3 flex items-center justify-center">
                        <div className="flex w-fit items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-sm font-medium text-neutral-700">
                          <GripVertical className="h-4 w-4 text-neutral-400" />
                          <span>{product.displayOrder + 1}</span>
                        </div>
                      </TableCell>

                      <TableCell className="p-3 text-center">
                        <Badge className={getStatusBadgeClass(product.status)}>
                          {product.status === "active" ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>

                      <TableCell className="p-3 text-sm text-center text-neutral-700">
                        {new Date(product.createdAt).toLocaleDateString(
                          "en-IN",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          },
                        )}
                        ,{" "}
                        {new Date(product.createdAt).toLocaleTimeString(
                          "en-IN",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
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
                              onClick={() => handleEditProduct(product.id)}
                            >
                              <PencilLine className="h-4 w-4" />
                            </Button>
                          </ActionTooltip>

                          {product.status === "active" ? (
                            <ActionTooltip
                              label="Deactivate"
                              align="center"
                              side="bottom"
                            >
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() =>
                                  void handleToggleProductStatus(
                                    product.id,
                                    "active",
                                  )
                                }
                              >
                                <CircleOff className="h-4 w-4" />
                              </Button>
                            </ActionTooltip>
                          ) : (
                            <ActionTooltip
                              label="Activate"
                              align="center"
                              side="bottom"
                            >
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                                onClick={() =>
                                  void handleToggleProductStatus(
                                    product.id,
                                    "inactive",
                                  )
                                }
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            </ActionTooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-28 text-center text-neutral-500"
                  >
                    No product suggestions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Footer */}
          <div className="flex flex-col gap-4 border-t p-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-neutral-500">
              Showing {from} to {to} of {totalItems} products
            </p>

            <div className="flex items-center gap-2">
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
                      className="px-2 text-sm text-neutral-500"
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
            </div>

            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(
                  Number(value) as (typeof PAGE_SIZE_OPTIONS)[number],
                );
                setPageIndex(0);
              }}
            >
              <SelectTrigger className="h-10 w-27.5">
                <SelectValue placeholder="10 / page" />
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

        <div className="hidden h-fit rounded-xl border bg-white">
          <div className="border-b px-4 py-3">
            <h3 className="text-[15px] font-semibold text-neutral-900">
              Product Details
            </h3>
          </div>

          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">
                Product Name
              </label>
              <Input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">
                Display Order
              </label>
              <Input
                value={draftDisplayOrder}
                onChange={(event) => setDraftDisplayOrder(event.target.value)}
                inputMode="numeric"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">
                Status
              </label>
              <Select
                value={draftStatus}
                onValueChange={(value) => setDraftStatus(value as StatusFilter)}
                disabled={mode === "create"}
              >
                <SelectTrigger className="w-full rounded-md">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-neutral-500">
                New product suggestions are created as active.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="button"
                className="gap-2"
                onClick={() => void handleSubmit()}
                disabled={isBusy}
              >
                {mode === "create" ? (
                  <Plus className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {mode === "create" ? "Create Product" : "Update Product"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (selectedProduct) {
                    setDraftName(selectedProduct.name);
                    setDraftDisplayOrder(
                      String(selectedProduct.displayOrder + 1),
                    );
                    setDraftStatus(selectedProduct.status);
                  } else {
                    setMode("edit");
                  }
                }}
                disabled={isBusy}
              >
                Cancel
              </Button>
            </div>

            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "w-full",
                  selectedProduct?.status === "active"
                    ? "border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    : "border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700",
                )}
                onClick={() => {
                  if (!selectedProduct || mode === "create") return;
                  void handleToggleProductStatus(
                    selectedProduct.id,
                    selectedProduct.status === "active" ? "active" : "inactive",
                  );
                }}
                disabled={!selectedProduct || isBusy || mode === "create"}
              >
                {selectedProduct?.status === "active"
                  ? "Deactivate Product"
                  : "Activate Product"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Info Strip */}
      <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-neutral-500">
        <p>Use drag and drop to reorder product suggestions for Quick Entry.</p>

        <div className="flex items-center gap-2 text-[#266699]">
          <Sparkles className="h-4 w-4" />
          <span className="font-medium">All changes are auto-saved</span>
        </div>
      </div>
    </div>
  );
}
