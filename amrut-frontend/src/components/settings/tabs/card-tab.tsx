import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  BadgeDollarSign,
  CreditCard,
  History,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

import FilterSelect from "@/components/common/filter-select";
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
import { formatDate } from "@/utils/format-date";
import {
  useCardHistoryQuery,
  useCardsQuery,
  type CardResponse,
  type CardStatus,
} from "@/services/card.service";

type StatusFilter = "all" | "assigned" | "available";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const EMPTY_CARDS: CardResponse[] = [];

function getStatusBadgeClass(status: CardStatus) {
  return status === "assigned"
    ? "bg-blue-100 text-blue-700 hover:bg-blue-100"
    : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
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

function buildPageInfo(
  totalItems: number,
  pageIndex: number,
  pageSize: number,
) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  return {
    totalItems,
    totalPages,
    pageIndex,
    pageSize,
    hasPreviousPage: pageIndex > 0,
    hasNextPage: pageIndex < totalPages - 1,
    from: totalItems === 0 ? 0 : pageIndex * pageSize + 1,
    to: Math.min(totalItems, (pageIndex + 1) * pageSize),
  };
}

function getAssignedCustomer(card: CardResponse) {
  return card.currentAssignment?.customer.fullName ?? "Not assigned";
}

function getAssignedBy(card: CardResponse) {
  return card.currentAssignment?.assignedBy.fullName ?? "-";
}

function getAssignedAt(card: CardResponse) {
  return card.currentAssignment?.assignedAt ?? null;
}

function getTimelineTitle(item: {
  unassignedAt: string | null;
  customer: { fullName: string };
}) {
  return item.unassignedAt ? "Released from" : "Assigned to";
}

export default function CardTab() {
  const [searchText, setSearchText] = useState("");
  const searchQuery = useDebouncedValue(searchText);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const cardsQuery = useCardsQuery();

  const allCards = cardsQuery.data?.items ?? EMPTY_CARDS;

  const stats = cardsQuery.data?.summary ?? {
    totalCards: 0,
    assignedCards: 0,
    availableCards: 0,
  };

  const filteredCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return allCards.filter((card) => {
      const matchesStatus =
        statusFilter === "all" || card.status === statusFilter;

      const matchesSearch =
        query.length === 0 ||
        String(card.cardNumber).includes(query) ||
        card.currentAssignment?.customer.fullName
          .toLowerCase()
          .includes(query) ||
        card.currentAssignment?.customer.mobileNumber.includes(query) ||
        card.currentAssignment?.assignedBy.fullName
          .toLowerCase()
          .includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [allCards, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / pageSize));

  const currentPageIndex = Math.min(pageIndex, totalPages - 1);

  const pageInfo = useMemo(
    () => buildPageInfo(filteredCards.length, currentPageIndex, pageSize),
    [currentPageIndex, filteredCards.length, pageSize],
  );

  const visibleCards = useMemo(() => {
    const start = currentPageIndex * pageSize;

    return filteredCards.slice(start, start + pageSize);
  }, [currentPageIndex, filteredCards, pageSize]);

  const selectedCard = useMemo(() => {
    if (selectedCardId) {
      return filteredCards.find((card) => card.id === selectedCardId) ?? null;
    }

    return visibleCards[0] ?? null;
  }, [filteredCards, selectedCardId, visibleCards]);

  const historyQuery = useCardHistoryQuery(selectedCard?.id ?? null);

  const historyItems = historyQuery.data?.items ?? [];

  useEffect(() => {
    setPageIndex(0);
  }, [searchQuery, statusFilter, pageSize]);

  useEffect(() => {
    if (selectedCardId) {
      const exists = filteredCards.some((card) => card.id === selectedCardId);

      if (exists) {
        return;
      }
    }

    setSelectedCardId(visibleCards[0]?.id ?? filteredCards[0]?.id ?? null);
  }, [filteredCards, selectedCardId, visibleCards]);

  function goToPage(nextPageIndex: number) {
    setPageIndex(Math.min(Math.max(nextPageIndex, 0), pageInfo.totalPages - 1));
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b p-4">
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold text-neutral-900">Cards</h3>

          <p className="text-xs text-neutral-500">
            Read-only card directory with status, assignment, and summary data.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row">
          <div className="relative w-full sm:max-w-xl lg:w-80">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500 sm:right-4 sm:h-5 sm:w-5" />

            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search card, customer, user..."
            />
          </div>

          <FilterSelect
            label="Status"
            className="w-full sm:w-40"
            triggerClassName="w-full sm:w-40"
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="available">Available</SelectItem>
          </FilterSelect>
        </div>
      </div>

      <div className="grid gap-3 px-3 sm:px-4 grid-cols-3">
        <div className="rounded-2xl border bg-[#F9FBFF] p-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 text-sm font-medium text-neutral-600">
            <CreditCard className="h-4 w-4 text-[#266699]" />
            Total Cards
          </div>

          <div className="mt-2 text-2xl font-semibold text-neutral-900 text-center sm:text-left">
            {stats.totalCards}
          </div>
        </div>

        <div className="rounded-2xl border bg-[#F9FBFF] p-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 text-sm font-medium text-neutral-600">
            <UserRound className="h-4 w-4 text-[#266699]" />
            Assigned
          </div>

          <div className="mt-2 text-2xl font-semibold text-neutral-900 text-center sm:text-left">
            {stats.assignedCards}
          </div>
        </div>

        <div className="rounded-2xl border bg-[#F9FBFF] p-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 text-sm font-medium text-neutral-600">
            <BadgeDollarSign className="h-4 w-4 text-[#266699]" />
            Available
          </div>

          <div className="mt-2 text-2xl font-semibold text-neutral-900 text-center sm:text-left">
            {stats.availableCards}
          </div>
        </div>
      </div>

      <div className="grid gap-4 px-3 pb-4 sm:px-4 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="h-fit overflow-hidden rounded-xl border">
          <div className="w-full overflow-x-auto">
            <Table className="min-w-190">
              <TableHeader className="bg-[#F6F6F6]">
                <TableRow>
                  <TableHead className="p-3 text-center">Card No.</TableHead>
                  <TableHead className="p-3 text-center">
                    Assigned Customer
                  </TableHead>
                  <TableHead className="p-3 text-center">Assigned By</TableHead>
                  <TableHead className="p-3 text-center">Status</TableHead>
                  <TableHead className="p-3 text-center">Created On</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {cardsQuery.isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-28 text-center text-neutral-500"
                    >
                      Loading cards...
                    </TableCell>
                  </TableRow>
                ) : cardsQuery.isError ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-28 text-center text-red-600"
                    >
                      {(cardsQuery.error as Error)?.message ||
                        "Failed to load cards."}
                    </TableCell>
                  </TableRow>
                ) : visibleCards.length > 0 ? (
                  visibleCards.map((card) => {
                    const isSelected = card.id === selectedCard?.id;

                    return (
                      <TableRow
                        key={card.id}
                        className={[
                          "cursor-pointer transition-colors hover:bg-neutral-50",
                          isSelected ? "bg-blue-50/40" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => setSelectedCardId(card.id)}
                      >
                        <TableCell className="p-3 text-center font-medium text-neutral-900">
                          {card.cardNumber}
                        </TableCell>

                        <TableCell className="p-3 text-center text-neutral-700">
                          {getAssignedCustomer(card)}
                        </TableCell>

                        <TableCell className="p-3 text-center text-neutral-700">
                          {getAssignedBy(card)}
                        </TableCell>

                        <TableCell className="p-3 text-center">
                          <Badge className={getStatusBadgeClass(card.status)}>
                            {card.status === "assigned"
                              ? "Assigned"
                              : "Available"}
                          </Badge>
                        </TableCell>

                        <TableCell className="p-3 text-center text-sm text-neutral-700">
                          {formatDate(card.createdAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-28 text-center text-neutral-500"
                    >
                      No cards found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 border-t p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-neutral-500">
              Showing {pageInfo.from} to {pageInfo.to} of {pageInfo.totalItems}{" "}
              cards
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => goToPage(currentPageIndex - 1)}
                disabled={!pageInfo.hasPreviousPage || cardsQuery.isFetching}
              >
                <span className="text-lg leading-none">‹</span>
              </Button>

              {renderPaginationItems(
                currentPageIndex + 1,
                pageInfo.totalPages,
              ).map((item, index) =>
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
                    disabled={cardsQuery.isFetching}
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
                disabled={!pageInfo.hasNextPage || cardsQuery.isFetching}
              >
                <span className="text-lg leading-none">›</span>
              </Button>

              <Select
                value={String(pageSize)}
                onValueChange={(value) =>
                  setPageSize(
                    Number(value) as (typeof PAGE_SIZE_OPTIONS)[number],
                  )
                }
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

        <div className="h-fit rounded-xl border bg-white">
          <div className="border-b px-4 py-3">
            <h3 className="text-[15px] font-semibold text-neutral-900">
              Card Details
            </h3>
          </div>

          {!selectedCard ? (
            <div className="p-4">
              <p className="text-sm text-neutral-500">
                Select a card to inspect its details.
              </p>
            </div>
          ) : (
            <div className="space-y-4 p-4">
              <div className="rounded-xl border bg-[#F9FBFF] p-4">
                <div className="text-sm text-neutral-500">Card Number</div>

                <div className="mt-1 text-2xl font-semibold text-neutral-900">
                  {selectedCard.cardNumber}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-neutral-500">Status</div>

                  <Badge className={getStatusBadgeClass(selectedCard.status)}>
                    {selectedCard.status === "assigned"
                      ? "Assigned"
                      : "Available"}
                  </Badge>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="text-xs text-neutral-500">Created On</div>

                  <div className="mt-1 text-sm font-medium text-neutral-900">
                    {formatDate(selectedCard.createdAt)}
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="text-xs text-neutral-500">
                    Assigned Customer
                  </div>

                  <div className="mt-1 text-sm font-medium text-neutral-900">
                    {selectedCard.currentAssignment?.customer.fullName ??
                      "Not assigned"}
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="text-xs text-neutral-500">Assigned By</div>

                  <div className="mt-1 text-sm font-medium text-neutral-900">
                    {getAssignedBy(selectedCard)}
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="text-xs text-neutral-500">Assigned At</div>

                  <div className="mt-1 text-sm font-medium text-neutral-900">
                    {getAssignedAt(selectedCard)
                      ? formatDate(getAssignedAt(selectedCard)!)
                      : "-"}
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="text-xs text-neutral-500">Deposit</div>

                  <div className="mt-1 text-sm font-medium text-neutral-900">
                    ₹{selectedCard.currentAssignment?.depositAtAssignment}
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center gap-2 font-semibold text-neutral-900">
                  <History className="h-4 w-4 text-[#266699]" />
                  Card History
                </div>

                <div className="mt-3 space-y-3">
                  {historyQuery.isLoading ? (
                    <p className="text-sm text-neutral-500">
                      Loading history...
                    </p>
                  ) : historyItems.length > 0 ? (
                    historyItems.map((item, index) => (
                      <div
                        key={item.id}
                        className="relative rounded-xl border bg-white p-3"
                      >
                        {index !== historyItems.length - 1 ? (
                          <div className="absolute left-5 top-10 h-full w-px bg-neutral-200" />
                        ) : null}

                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#266699]">
                            <ArrowRightLeft className="h-4 w-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-neutral-900">
                                {getTimelineTitle(item)}{" "}
                                <span className="text-[#266699]">
                                  {item.customer.fullName}
                                </span>
                              </p>

                              <Badge
                                className={
                                  item.unassignedAt
                                    ? "bg-neutral-100 text-neutral-600 hover:bg-neutral-100"
                                    : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                }
                              >
                                {item.unassignedAt ? "Released" : "Active"}
                              </Badge>
                            </div>

                            <p className="mt-1 text-xs text-neutral-500">
                              {item.unassignedAt
                                ? `${formatDate(item.assignedAt)} → ${formatDate(item.unassignedAt)}`
                                : `Assigned on ${formatDate(item.assignedAt)}`}
                            </p>

                            <p className="mt-1 text-xs text-neutral-500">
                              By {item.assignedBy.fullName}
                              {item.depositAtAssignment > 0
                                ? ` · Deposit ₹${item.depositAtAssignment}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-neutral-500">
                      No history found.
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center gap-2 font-semibold text-neutral-900">
                  <ShieldCheck className="h-4 w-4 text-[#266699]" />
                  Assignment Snapshot
                </div>

                <div className="mt-3 space-y-2 text-sm text-neutral-600">
                  <p>
                    {selectedCard.currentAssignment
                      ? "This card is currently linked to one customer."
                      : "This card is currently free and not linked to any customer."}
                  </p>

                  <p>
                    Card lifecycle actions are handled from the customer details
                    drawer.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t px-3 py-3 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <p>Card records are informational in this screen.</p>

        <div className="flex items-center gap-2 text-[#266699]">
          <Sparkles className="h-4 w-4" />
          <span className="font-medium">Read-only view</span>
        </div>
      </div>
    </div>
  );
}
