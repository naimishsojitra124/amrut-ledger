import { useMemo, useState, type ReactNode } from "react";

import { CircleAlert, Edit3, ReceiptText, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Textarea } from "@/components/ui/textarea";

import { formatCurrency } from "@/utils/format-currency";
import { formatDate } from "@/utils/format-date";

import { useModalStore } from "@/store/modal.store";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/permissions";
import FullLedgerModal from "../modals/full-ledger-modal";

import type { Customer } from "@/types/customer";

import {
  useDeleteDailyLedgerEntryMutation,
  useUpdateDailyLedgerEntryMutation,
  type DailyLedgerEntryResponse,
  type DailyLedgerProductEntryRequest,
  type DailyLedgerResponse,
  type UpdateDailyLedgerEntryRequest,
} from "@/services/daily-ledger.service";

type QuickEntryLedgerProps = {
  customer: Customer | null;
  ledger?: DailyLedgerResponse | null;
  selectedDate: string;
};

type LedgerLineItem = {
  id: string;
  kind: "milk" | "product";
  title: string;
  subtitle: string;
  amount: number;
};

type EntryRow = {
  id: string;
  entryId: string;
  entryIndex: number;
  time: Date;
  createdByName: string;
  milkRows: LedgerLineItem[];
  productRows: LedgerLineItem[];
  entryTotal: number;
  note?: string;
};

type EditMilkEntry = {
  milkTypeId: string;
  milkTypeName: string;
  litres: number;
  rate: number;
};

type EditProductEntry = {
  productSuggestionId: string | null;
  itemName: string;
  quantity: number;
  unitPrice: number;
};

type EditDraft = {
  milkEntries: EditMilkEntry[];
  productEntries: EditProductEntry[];
  notes: string;
};

const TIME_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
});

export default function QuickEntryLedger({
  customer,
  ledger,
  selectedDate,
}: QuickEntryLedgerProps) {
  const activeModal = useModalStore((state) => state.activeModal);
  const closeModal = useModalStore((state) => state.closeModal);
  const openModal = useModalStore((state) => state.openModal);
  const openFullLedger = useModalStore((state) => state.openFullLedger);

  const updateEntryMutation = useUpdateDailyLedgerEntryMutation();
  const deleteEntryMutation = useDeleteDailyLedgerEntryMutation();

  // Correcting an entry and removing one are separate permissions: counter
  // staff fix their own typos, but taking a charge off the ledger is a
  // manager's call.
  const { can } = usePermissions();
  const canEditEntries = can(PERMISSIONS.LEDGER_ENTRY_UPDATE);
  const canDeleteEntries = can(PERMISSIONS.LEDGER_ENTRY_DELETE);

  const [editingEntry, setEditingEntry] =
    useState<DailyLedgerEntryResponse | null>(null);

  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

  const [deletingEntry, setDeletingEntry] =
    useState<DailyLedgerEntryResponse | null>(null);

  const { entryRows, summary } = useMemo(() => {
    const entries = ledger?.entries ?? [];

    const milkMap = new Map<
      string,
      {
        litres: number;
        amount: number;
        rate: number;
      }
    >();

    const productMap = new Map<
      string,
      {
        quantity: number;
        amount: number;
      }
    >();

    let milkAmount = 0;
    let productAmount = 0;
    let totalItems = 0;

    for (const entry of entries) {
      totalItems += entry.milkEntries.length + entry.productEntries.length;

      for (const milk of entry.milkEntries) {
        const amount = milk.litres * milk.rate;
        milkAmount += amount;

        const existing = milkMap.get(milk.milkTypeName);

        if (existing) {
          existing.litres += milk.litres;
          existing.amount += amount;
        } else {
          milkMap.set(milk.milkTypeName, {
            litres: milk.litres,
            amount,
            rate: milk.rate,
          });
        }
      }

      for (const product of entry.productEntries) {
        const amount = product.quantity * product.unitPrice;
        productAmount += amount;

        const existing = productMap.get(product.itemName);

        if (existing) {
          existing.quantity += product.quantity;
          existing.amount += amount;
        } else {
          productMap.set(product.itemName, {
            quantity: product.quantity,
            amount,
          });
        }
      }
    }

    const entryRows: EntryRow[] = [...entries]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .map((entry) => {
        const milkRows: LedgerLineItem[] = entry.milkEntries.map(
          (milk, index) => ({
            id: `${entry.id}-milk-${index}`,
            kind: "milk",
            title: milk.milkTypeName,
            subtitle: `${milk.litres.toFixed(2)} Ltr`,
            amount: milk.litres * milk.rate,
          }),
        );

        const productRows: LedgerLineItem[] = entry.productEntries.map(
          (product, index) => ({
            id: `${entry.id}-product-${index}`,
            kind: "product",
            title: product.itemName,
            subtitle: `${product.quantity} Qty`,
            amount: product.quantity * product.unitPrice,
          }),
        );

        return {
          id: entry.id,
          entryId: entry.id,
          entryIndex: entry.entryIndex,
          time: new Date(entry.createdAt),
          createdByName: entry.createdBy.fullName,
          milkRows,
          productRows,
          entryTotal:
            milkRows.reduce((sum, row) => sum + row.amount, 0) +
            productRows.reduce((sum, row) => sum + row.amount, 0),
          note: entry.notes?.trim() || undefined,
        };
      });

    return {
      entryRows,
      summary: {
        milkRows: [...milkMap.entries()],
        productRows: [...productMap.entries()],
        milkAmount,
        productAmount,
        totalAmount: milkAmount + productAmount,
        totalItems,
        entryCount: entries.length,
        ledgerDate: ledger?.ledgerDate ?? selectedDate,
      },
    };
  }, [ledger, selectedDate]);

  const hasLedger = entryRows.length > 0;
  const ledgerDateLabel = formatDate(summary.ledgerDate);

  /**
   * Looked up by id, not position: another device may have removed an entry
   * since this page loaded, which would shift every index after it.
   */
  function getOriginalEntry(entryId: string) {
    return ledger?.entries.find((entry) => entry.id === entryId);
  }

  function handleEditClick(entryId: string) {
    const entry = getOriginalEntry(entryId);

    if (!entry) {
      return;
    }

    setEditingEntry(entry);

    setEditDraft({
      milkEntries: entry.milkEntries.map((milk) => ({
        milkTypeId: milk.milkTypeId,
        milkTypeName: milk.milkTypeName,
        litres: milk.litres,
        rate: milk.rate,
      })),
      productEntries: entry.productEntries.map((product) => ({
        productSuggestionId: product.productSuggestionId,
        itemName: product.itemName,
        quantity: product.quantity,
        unitPrice: product.unitPrice,
      })),
      notes: entry.notes ?? "",
    });

    openModal("editLedger");
  }

  function handleDeleteClick(entryId: string) {
    const entry = getOriginalEntry(entryId);

    if (!entry) {
      return;
    }

    setDeletingEntry(entry);
    openModal("deleteLedger");
  }

  function closeEditDialog() {
    if (updateEntryMutation.isPending) {
      return;
    }

    setEditingEntry(null);
    setEditDraft(null);
    closeModal();
  }

  function handleMilkLitresChange(index: number, value: string) {
    const litres = Number(value);

    setEditDraft((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        milkEntries: previous.milkEntries.map((entry, entryIndex) =>
          entryIndex === index
            ? {
                ...entry,
                litres: Number.isFinite(litres) ? litres : 0,
              }
            : entry,
        ),
      };
    });
  }

  function handleProductQuantityChange(index: number, value: string) {
    const quantity = Number(value);

    setEditDraft((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        productEntries: previous.productEntries.map((entry, entryIndex) =>
          entryIndex === index
            ? {
                ...entry,
                quantity: Number.isFinite(quantity) ? quantity : 0,
              }
            : entry,
        ),
      };
    });
  }

  function handleProductUnitPriceChange(index: number, value: string) {
    const unitPrice = Number(value);

    setEditDraft((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        productEntries: previous.productEntries.map((entry, entryIndex) =>
          entryIndex === index
            ? {
                ...entry,
                unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
              }
            : entry,
        ),
      };
    });
  }

  function handleSaveEdit() {
    if (!customer || !editingEntry || !editDraft) {
      return;
    }

    const milkEntries = editDraft.milkEntries
      .filter((entry) => entry.litres > 0)
      .map((entry) => ({
        milkTypeId: entry.milkTypeId,
        litres: entry.litres,
      }));

    const productEntries: DailyLedgerProductEntryRequest[] =
      editDraft.productEntries
        .filter(
          (entry) =>
            entry.quantity > 0 &&
            entry.unitPrice >= 0 &&
            Boolean(entry.itemName.trim()),
        )
        .map((entry) => ({
          productSuggestionId: entry.productSuggestionId,
          itemName: entry.itemName.trim(),
          quantity: entry.quantity,
          unitPrice: entry.unitPrice,
        }));

    if (!milkEntries.length && !productEntries.length) {
      return;
    }

    const payload: UpdateDailyLedgerEntryRequest = {
      milkEntries,
      productEntries,
      notes: editDraft.notes.trim(),
    };

    updateEntryMutation.mutate(
      {
        customerId: customer.id,
        date: selectedDate,
        entryId: editingEntry.id,
        payload,
      },
      {
        onSuccess: () => {
          setEditingEntry(null);
          setEditDraft(null);
          closeModal();
        },
      },
    );
  }

  function handleDeleteEntry() {
    if (!customer || !deletingEntry) {
      return;
    }

    deleteEntryMutation.mutate(
      {
        customerId: customer.id,
        date: selectedDate,
        entryId: deletingEntry.id,
      },
      {
        onSuccess: () => {
          setDeletingEntry(null);
          closeModal();
        },
      },
    );
  }

  return (
    <>
      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.72fr)]">
        <div className="min-w-0 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-[#266699] sm:text-[18px]">
                Entries for{" "}
                <span className="text-sm font-medium">{ledgerDateLabel}</span>
              </h3>

              <p className="text-xs text-neutral-500">
                Saved entries for the selected customer on the selected day.
              </p>
            </div>

            <Badge className="w-fit bg-blue-50 text-[#266699] hover:bg-blue-50">
              {summary.entryCount} Entries
            </Badge>
          </div>

          <div className="p-3 sm:p-5">
            {customer ? (
              hasLedger ? (
                <div className="space-y-3 sm:space-y-0">
                  {entryRows.map((entry) => (
                    <div
                      key={entry.id}
                      className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[86px_24px_minmax(0,1fr)] sm:gap-3"
                    >
                      {/* Mobile: normal full-width time label.
                          Desktop/tablet: becomes the left timeline column. */}
                      <div className="px-1 text-xs font-medium text-neutral-500 sm:pt-2 sm:text-sm sm:text-neutral-700">
                        {TIME_FORMATTER.format(entry.time)}
                      </div>

                      {/* Timeline rail is intentionally removed on mobile. */}
                      <div className="relative hidden justify-center sm:flex">
                        <div className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-neutral-300" />

                        <div className="relative z-10 mt-3 h-3 w-3 shrink-0 rounded-full bg-[#266699] shadow-sm" />
                      </div>

                      <article className="min-w-0 overflow-hidden rounded-2xl border bg-white shadow-sm sm:mb-4">
                        <div className="flex flex-col gap-3 border-b px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                          <div className="min-w-0">
                            <Badge
                              variant="secondary"
                              className="bg-blue-50 text-[#266699] hover:bg-blue-50"
                            >
                              Entry
                            </Badge>

                            <span className="ml-2 text-xs font-medium text-neutral-700 sm:text-sm">
                              Added by {entry.createdByName}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {canEditEntries && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                disabled={
                                  updateEntryMutation.isPending ||
                                  deleteEntryMutation.isPending
                                }
                                onClick={() => handleEditClick(entry.entryId)}
                                aria-label="Edit entry"
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                            )}

                            {canDeleteEntries && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-600"
                                disabled={
                                  updateEntryMutation.isPending ||
                                  deleteEntryMutation.isPending
                                }
                                onClick={() => handleDeleteClick(entry.entryId)}
                                aria-label="Delete entry"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3 px-3 py-3 sm:px-4">
                          <LineItems
                            rows={entry.milkRows}
                            type="Milk"
                            badgeClassName="bg-blue-50 text-[#266699] hover:bg-blue-50"
                          />

                          <LineItems
                            rows={entry.productRows}
                            type="Product"
                            badgeClassName="bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                          />

                          {entry.note && (
                            <div className="rounded-lg bg-neutral-50 px-3 py-2">
                              <p className="text-xs font-medium text-neutral-500">
                                Note
                              </p>

                              <p className="mt-1 wrap-break-word text-sm text-neutral-700">
                                {entry.note}
                              </p>
                            </div>
                          )}

                          <div className="flex justify-end border-t pt-3">
                            <span className="text-sm font-semibold text-neutral-900">
                              Entry Total: {formatCurrency(entry.entryTotal)}
                            </span>
                          </div>
                        </div>
                      </article>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<CircleAlert className="h-10 w-10 text-neutral-300" />}
                  title="No entries added yet"
                  description={`Save the first entry for ${customer.fullName} and it will appear here as a timeline.`}
                />
              )
            ) : (
              <EmptyState
                icon={<ReceiptText className="h-10 w-10 text-neutral-300" />}
                title="Search a customer first"
                description="Once a customer is loaded, the selected day's entries will appear here."
              />
            )}
          </div>
        </div>

        <div className="h-fit min-w-0 overflow-hidden rounded-2xl border bg-white shadow-sm xl:sticky xl:top-3">
          <div className="border-b px-4 py-4 sm:px-5">
            <h3 className="text-base font-semibold text-[#266699] sm:text-[18px]">
              Selected Day&apos;s Summary
            </h3>

            <p className="text-xs text-neutral-500">
              Quick totals for the current customer ledger.
            </p>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            <SummaryList
              title="Milk Summary"
              rows={summary.milkRows.map(([name, value]) => ({
                label: name,
                meta: `${value.litres.toFixed(
                  2,
                )} Ltr × ${formatCurrency(value.rate)}/L`,
                amount: value.amount,
              }))}
              emptyText="No milk entries"
            />

            <SummaryList
              title="Product Summary"
              rows={summary.productRows.map(([name, value]) => ({
                label: name,
                meta: `${value.quantity} Qty`,
                amount: value.amount,
              }))}
              emptyText="No product entries"
            />

            <div className="border-t pt-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-neutral-700">
                  Total Products
                </span>

                <span className="font-semibold text-neutral-900">
                  {formatCurrency(summary.productAmount)}
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-blue-50 px-3 py-4 sm:px-4">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-[#266699] sm:text-lg">
                  Selected Day Total
                </span>

                <span className="text-lg font-bold text-[#266699]">
                  {formatCurrency(summary.totalAmount)}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-11 w-full gap-2"
              disabled={!hasLedger || !customer}
              onClick={() => {
                if (!customer) {
                  return;
                }

                openFullLedger({
                  customerId: customer.id,
                  selectedDate,
                  outstandingAmount: customer.outstandingAmount,
                });
              }}
            >
              View Full Ledger
            </Button>
          </div>
        </div>
      </section>

      <Dialog
        open={
          activeModal === "editLedger" && Boolean(editingEntry && editDraft)
        }
        onOpenChange={(open) => {
          if (!open) {
            closeEditDialog();
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] w-[calc(100%-1.5rem)] overflow-y-auto sm:max-w-155">
          <DialogHeader>
            <DialogTitle>Edit Ledger Entry</DialogTitle>

            <DialogDescription>
              Correct the quantities or details of this daily entry.
            </DialogDescription>
          </DialogHeader>

          {editDraft && (
            <div className="space-y-5 py-2 sm:space-y-6">
              {editDraft.milkEntries.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-neutral-900">
                    Milk
                  </h4>

                  {editDraft.milkEntries.map((entry, index) => (
                    <div
                      key={`${entry.milkTypeId}-${index}`}
                      className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_140px]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-neutral-900">
                          {entry.milkTypeName}
                        </p>

                        <p className="text-xs text-neutral-500">
                          {formatCurrency(entry.rate)}/L
                        </p>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600">
                          Litres
                        </label>

                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={entry.litres}
                          onChange={(event) =>
                            handleMilkLitresChange(index, event.target.value)
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {editDraft.productEntries.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-neutral-900">
                    Products
                  </h4>

                  {editDraft.productEntries.map((entry, index) => (
                    <div
                      key={`${entry.itemName}-${index}`}
                      className="rounded-xl border p-3"
                    >
                      <p className="mb-3 truncate text-sm font-medium text-neutral-900">
                        {entry.itemName}
                      </p>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-neutral-600">
                            Quantity
                          </label>

                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={entry.quantity}
                            onChange={(event) =>
                              handleProductQuantityChange(
                                index,
                                event.target.value,
                              )
                            }
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-neutral-600">
                            Unit Price
                          </label>

                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={entry.unitPrice}
                            onChange={(event) =>
                              handleProductUnitPriceChange(
                                index,
                                event.target.value,
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">
                  Notes
                </label>

                <Textarea
                  value={editDraft.notes}
                  onChange={(event) =>
                    setEditDraft((previous) =>
                      previous
                        ? {
                            ...previous,
                            notes: event.target.value,
                          }
                        : previous,
                    )
                  }
                  placeholder="Add a note for this entry..."
                  rows={3}
                  maxLength={500}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={updateEntryMutation.isPending}
              onClick={closeEditDialog}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>

            <Button
              type="button"
              disabled={
                updateEntryMutation.isPending ||
                !editDraft ||
                (!editDraft.milkEntries.length &&
                  !editDraft.productEntries.length)
              }
              onClick={handleSaveEdit}
              className="w-full sm:w-auto"
            >
              {updateEntryMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={activeModal === "deleteLedger" && Boolean(deletingEntry)}
        onOpenChange={(open) => {
          if (!open && !deleteEntryMutation.isPending) {
            setDeletingEntry(null);
            closeModal();
          }
        }}
      >
        <AlertDialogContent className="w-[calc(100%-1.5rem)] max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this ledger entry?</AlertDialogTitle>

            <AlertDialogDescription>
              This will permanently remove this entry from the selected
              day&apos;s ledger. The daily totals will be recalculated
              automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <AlertDialogCancel disabled={deleteEntryMutation.isPending}>
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={deleteEntryMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
              onClick={(event) => {
                event.preventDefault();
                handleDeleteEntry();
              }}
            >
              {deleteEntryMutation.isPending ? "Deleting..." : "Delete Entry"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FullLedgerModal />
    </>
  );
}

function LineItems({
  rows,
  type,
  badgeClassName,
}: {
  rows: LedgerLineItem[];
  type: string;
  badgeClassName: string;
}) {
  if (!rows.length) {
    return null;
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div
          key={row.id}
          className="grid gap-2 rounded-lg border border-neutral-100 bg-neutral-50/60 p-2.5 sm:grid-cols-[90px_minmax(0,1fr)_110px] sm:items-center sm:border-0 sm:bg-transparent sm:p-0"
        >
          <div>
            <Badge className={badgeClassName}>{type}</Badge>
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-neutral-900">
              {row.title}
            </p>

            <p className="text-xs text-neutral-500">{row.subtitle}</p>
          </div>

          <div className="text-right text-sm font-semibold text-neutral-900">
            {formatCurrency(row.amount)}
          </div>
        </div>
      ))}
    </div>
  );
}

function SummaryList({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: Array<{
    label: string;
    meta: string;
    amount: number;
  }>;
  emptyText: string;
}) {
  return (
    <div>
      <div className="mb-2 text-base font-medium text-neutral-700">{title}</div>

      {rows.length > 0 ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={`${title}-${row.label}`}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-neutral-900">
                  {row.label}
                </p>

                <p className="truncate text-xs text-neutral-500">{row.meta}</p>
              </div>

              <span className="shrink-0 font-semibold text-neutral-900">
                {formatCurrency(row.amount)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-neutral-500">{emptyText}</p>
      )}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed bg-neutral-50 px-6 text-center sm:min-h-80">
      {icon}

      <p className="mt-3 text-sm font-medium text-neutral-900">{title}</p>

      <p className="mt-1 max-w-sm text-sm text-neutral-500">{description}</p>
    </div>
  );
}
