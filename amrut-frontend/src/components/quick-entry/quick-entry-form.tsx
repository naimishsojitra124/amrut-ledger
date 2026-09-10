import { useEffect, useMemo, useState } from "react";

import {
  BadgePlus,
  Droplets,
  Plus,
  RotateCcw,
  Save,
  ShoppingCart,
  Trash2,
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

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format-currency";

import type { Customer } from "@/types/customer";

import {
  type AddDailyLedgerEntryRequest,
  type DailyLedgerResponse,
} from "@/services/daily-ledger.service";

import { useActiveMilkTypesQuery } from "@/hooks/use-milk-types";

import {
  type ProductSuggestion,
  useActiveProductSuggestionsQuery,
} from "@/services/product-suggestion.service";

import { offlineQuickEntryCache } from "@/services/offline-quick-entry-cache.service";

type QuickEntryFormProps = {
  customer: Customer | null;
  ledger?: DailyLedgerResponse | null;
  isBusy?: boolean;
  isOnline?: boolean;
  onSaveEntry: (entry: AddDailyLedgerEntryRequest) => Promise<void>;
};

type MilkTypeOption = {
  id?: string;
  _id?: string;
  name: string;
  rate: number;
};

type DraftMilkRow = {
  id: string;
  milkTypeId: string;
  litres: number;
};

type DraftProductRow = {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
};

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function getItemId(item: MilkTypeOption) {
  return item.id ?? item._id ?? "";
}

function getLatestLedgerEntry(ledger: DailyLedgerResponse | null | undefined) {
  if (!ledger?.entries?.length) {
    return null;
  }

  return ledger.entries.reduce((latest, entry) => {
    if (!latest) {
      return entry;
    }

    return new Date(entry.createdAt).getTime() >
      new Date(latest.createdAt).getTime()
      ? entry
      : latest;
  }, ledger.entries[0]);
}

export default function QuickEntryForm({
  customer,
  ledger,
  isBusy = false,
  isOnline = true,
  onSaveEntry,
}: QuickEntryFormProps) {
  const milkTypesQuery = useActiveMilkTypesQuery();
  const productSuggestionsQuery = useActiveProductSuggestionsQuery();

  useEffect(() => {
    const items = milkTypesQuery.data?.items;

    if (items?.length) {
      offlineQuickEntryCache.saveMilkTypes(items);
    }
  }, [milkTypesQuery.data?.items]);

  useEffect(() => {
    const items = productSuggestionsQuery.data?.items;

    if (items?.length) {
      offlineQuickEntryCache.saveProducts(items);
    }
  }, [productSuggestionsQuery.data?.items]);

  const activeMilkTypes = useMemo<MilkTypeOption[]>(() => {
    const items = isOnline
      ? (milkTypesQuery.data?.items ?? [])
      : (milkTypesQuery.data?.items ??
        offlineQuickEntryCache.get().milkTypes);

    return items as MilkTypeOption[];
  }, [isOnline, milkTypesQuery.data?.items]);

  const quickProductSuggestions = useMemo(() => {
    const items = isOnline
      ? (productSuggestionsQuery.data?.items ?? [])
      : (productSuggestionsQuery.data?.items ??
        (offlineQuickEntryCache.get().products as ProductSuggestion[]));

    return [...items]
      .filter((item) => item.status === "active")
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .slice(0, 15);
  }, [isOnline, productSuggestionsQuery.data?.items]);

  const milkTypeMap = useMemo(() => {
    return new Map(
      activeMilkTypes
        .map((milkType) => [getItemId(milkType), milkType] as const)
        .filter(([id]) => Boolean(id)),
    );
  }, [activeMilkTypes]);

  const defaultMilkTypeId = useMemo(() => {
    if (!activeMilkTypes.length) {
      return "";
    }

    const customerDefault =
      customer?.milkTypes.find((item) => item.isDefault)?.milkTypeId ??
      customer?.milkTypes[0]?.milkTypeId ??
      "";

    if (customerDefault && milkTypeMap.has(customerDefault)) {
      return customerDefault;
    }

    return getItemId(activeMilkTypes[0]);
  }, [activeMilkTypes, customer, milkTypeMap]);

  const [milkTypeId, setMilkTypeId] = useState("");
  const [milkLitres, setMilkLitres] = useState("");

  const [productName, setProductName] = useState("");
  const [productQuantity, setProductQuantity] = useState("");
  const [productUnitPrice, setProductUnitPrice] = useState("");

  const [draftMilkRows, setDraftMilkRows] = useState<DraftMilkRow[]>([]);
  const [draftProductRows, setDraftProductRows] = useState<DraftProductRow[]>(
    [],
  );

  const selectedMilkTypeId = milkTypeId || defaultMilkTypeId;

  const selectedMilkType =
    milkTypeMap.get(selectedMilkTypeId) ?? null;

  const currentProductTotal = useMemo(() => {
    const quantity = Number(productQuantity);
    const unitPrice = Number(productUnitPrice);

    if (
      !Number.isFinite(quantity) ||
      !Number.isFinite(unitPrice) ||
      quantity <= 0 ||
      unitPrice < 0
    ) {
      return 0;
    }

    return quantity * unitPrice;
  }, [productQuantity, productUnitPrice]);

  const currentEntryTotal = useMemo(() => {
    const milkTotal = draftMilkRows.reduce((sum, row) => {
      const milkType = milkTypeMap.get(row.milkTypeId);

      return sum + row.litres * (milkType?.rate ?? 0);
    }, 0);

    const productTotal = draftProductRows.reduce(
      (sum, row) => sum + row.quantity * row.unitPrice,
      0,
    );

    return milkTotal + productTotal;
  }, [draftMilkRows, draftProductRows, milkTypeMap]);

  const latestLedgerEntry = useMemo(
    () => getLatestLedgerEntry(ledger),
    [ledger],
  );

  const canRepeatLastEntry = Boolean(customer && latestLedgerEntry);

  function handleAddMilkRow() {
    const litres = Number(milkLitres);

    if (
      !customer ||
      !selectedMilkTypeId ||
      !Number.isFinite(litres) ||
      litres <= 0
    ) {
      return;
    }

    setDraftMilkRows((previous) => [
      ...previous,
      {
        id: createId("milk"),
        milkTypeId: selectedMilkTypeId,
        litres,
      },
    ]);

    setMilkLitres("");
  }

  function handleAddProductRow() {
    const quantity = Number(productQuantity);
    const unitPrice = Number(productUnitPrice);
    const itemName = productName.trim();

    if (
      !customer ||
      !itemName ||
      !Number.isFinite(quantity) ||
      !Number.isFinite(unitPrice) ||
      quantity <= 0 ||
      unitPrice < 0
    ) {
      return;
    }

    setDraftProductRows((previous) => [
      ...previous,
      {
        id: createId("product"),
        itemName,
        quantity,
        unitPrice,
      },
    ]);

    setProductName("");
    setProductQuantity("");
    setProductUnitPrice("");
  }

  function handleRemoveMilkRow(rowId: string) {
    setDraftMilkRows((previous) =>
      previous.filter((row) => row.id !== rowId),
    );
  }

  function handleRemoveProductRow(rowId: string) {
    setDraftProductRows((previous) =>
      previous.filter((row) => row.id !== rowId),
    );
  }

  function handleRepeatLastEntry() {
    if (!latestLedgerEntry) {
      return;
    }

    setDraftMilkRows(
      latestLedgerEntry.milkEntries.map((milk) => ({
        id: createId("milk"),
        milkTypeId: milk.milkTypeId,
        litres: milk.litres,
      })),
    );

    setDraftProductRows(
      latestLedgerEntry.productEntries.map((product) => ({
        id: createId("product"),
        itemName: product.itemName,
        quantity: product.quantity,
        unitPrice: product.unitPrice,
      })),
    );
  }

  async function handleSaveEntry() {
    if (!customer) {
      return;
    }

    if (!draftMilkRows.length && !draftProductRows.length) {
      return;
    }

    await onSaveEntry({
      milkEntries: draftMilkRows.map((row) => ({
        milkTypeId: row.milkTypeId,
        litres: row.litres,
      })),
      productEntries: draftProductRows.map((row) => ({
        itemName: row.itemName,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
      })),
      notes: "",
    });

    setDraftMilkRows([]);
    setDraftProductRows([]);
    setMilkLitres("");
    setProductName("");
    setProductQuantity("");
    setProductUnitPrice("");
  }

  function handleClearDraft() {
    setDraftMilkRows([]);
    setDraftProductRows([]);
    setMilkLitres("");
    setProductName("");
    setProductQuantity("");
    setProductUnitPrice("");
  }

  function handlePickSuggestion(name: string) {
    setProductName(name);
  }

  const hasDraft =
    draftMilkRows.length > 0 || draftProductRows.length > 0;

  return (
    <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_320px]">
      <div className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#266699]">
            <Droplets className="h-4 w-4" />
          </div>

          <h3 className="text-[15px] font-semibold text-neutral-900">
            Add Milk Entry
          </h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700">
              Milk Type
            </label>

            <Select
              value={selectedMilkTypeId}
              onValueChange={setMilkTypeId}
              disabled={!customer || !activeMilkTypes.length || isBusy}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Select milk type" />
              </SelectTrigger>

              <SelectContent>
                {activeMilkTypes.map((milkType) => {
                  const value = getItemId(milkType);

                  if (!value) {
                    return null;
                  }

                  return (
                    <SelectItem key={value} value={value}>
                      {milkType.name} (₹{milkType.rate}/L)
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">
                Litres
              </label>

              <Input
                value={milkLitres}
                onChange={(event) => setMilkLitres(event.target.value)}
                disabled={!customer || isBusy}
                placeholder="e.g. 1.5"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">
                Rate
              </label>

              <Input
                value={
                  selectedMilkType
                    ? `₹${selectedMilkType.rate} / L`
                    : "—"
                }
                disabled
                className="h-11 bg-neutral-50 text-neutral-700"
              />
            </div>
          </div>

          <Button
            type="button"
            className="h-11 w-full gap-2"
            onClick={handleAddMilkRow}
            disabled={
              !customer ||
              !selectedMilkTypeId ||
              !activeMilkTypes.length ||
              isBusy
            }
          >
            <Plus className="h-4 w-4" />
            Add Milk
          </Button>

          {draftMilkRows.length > 0 && (
            <DraftSection title="Draft Milk Rows">
              {draftMilkRows.map((row) => {
                const milkType = milkTypeMap.get(row.milkTypeId);
                const amount = row.litres * (milkType?.rate ?? 0);

                return (
                  <DraftRow
                    key={row.id}
                    title={milkType?.name ?? "Milk"}
                    subtitle={`${row.litres.toFixed(
                      2,
                    )} Ltr × ${formatCurrency(milkType?.rate ?? 0)}`}
                    amount={amount}
                    badgeClassName="bg-blue-50 text-[#266699] hover:bg-blue-50"
                    onRemove={() => handleRemoveMilkRow(row.id)}
                    disabled={isBusy}
                  />
                );
              })}
            </DraftSection>
          )}
        </div>
      </div>

      <div className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <ShoppingCart className="h-4 w-4" />
          </div>

          <h3 className="text-[15px] font-semibold text-neutral-900">
            Add Product Entry
          </h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700">
              Item Name
            </label>

            <Input
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
              disabled={!customer || isBusy}
              placeholder="e.g. Bread"
              type="text"
              className="h-11"
              maxLength={100}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">
                Quantity
              </label>

              <Input
                value={productQuantity}
                onChange={(event) =>
                  setProductQuantity(event.target.value)
                }
                disabled={!customer || isBusy}
                placeholder="e.g. 1"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">
                Unit Price (₹)
              </label>

              <Input
                value={productUnitPrice}
                onChange={(event) =>
                  setProductUnitPrice(event.target.value)
                }
                disabled={!customer || isBusy}
                placeholder="e.g. 35"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="h-11"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
            <span className="text-sm font-medium text-neutral-600">
              Current Product Total
            </span>

            <span className="font-semibold text-neutral-900">
              {formatCurrency(currentProductTotal)}
            </span>
          </div>

          {quickProductSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {quickProductSuggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  disabled={!customer || isBusy}
                  onClick={() => handlePickSuggestion(suggestion.name)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition",
                    productName === suggestion.name
                      ? "border-blue-200 bg-blue-50 text-[#266699]"
                      : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
                    (!customer || isBusy) &&
                      "cursor-not-allowed opacity-50",
                  )}
                >
                  {suggestion.name}
                </button>
              ))}
            </div>
          )}

          <Button
            type="button"
            className="h-11 w-full gap-2"
            onClick={handleAddProductRow}
            disabled={!customer || isBusy}
          >
            <BadgePlus className="h-4 w-4" />
            Add Product
          </Button>

          {draftProductRows.length > 0 && (
            <DraftSection title="Draft Product Rows">
              {draftProductRows.map((row) => (
                <DraftRow
                  key={row.id}
                  title={row.itemName}
                  subtitle={`${row.quantity} Qty × ${formatCurrency(
                    row.unitPrice,
                  )}`}
                  amount={row.quantity * row.unitPrice}
                  badgeClassName="bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                  onRemove={() => handleRemoveProductRow(row.id)}
                  disabled={isBusy}
                />
              ))}
            </DraftSection>
          )}
        </div>
      </div>

      <div className="h-fit min-w-0 rounded-2xl border bg-white p-4 shadow-sm sm:p-5 xl:sticky xl:top-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-neutral-900">
              Current Entry Total
            </h3>

            <p className="mt-1 text-xs text-neutral-500">
              Total for the draft entry currently being prepared.
            </p>
          </div>

          <div className="shrink-0 rounded-xl bg-blue-50 px-3 py-2 text-right">
            <p className="text-xs font-medium text-neutral-600">
              Amount
            </p>

            <p className="text-xl font-semibold text-[#266699] sm:text-2xl">
              {formatCurrency(currentEntryTotal)}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <Button
            type="button"
            className="h-11 w-full gap-2"
            onClick={() => void handleSaveEntry()}
            disabled={!customer || !hasDraft || isBusy}
          >
            <Save className="h-4 w-4" />
            {isBusy ? "Saving..." : "Save This Entry"}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full gap-2"
            onClick={handleRepeatLastEntry}
            disabled={!canRepeatLastEntry || isBusy}
          >
            <RotateCcw className="h-4 w-4" />
            Repeat Last Entry
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full gap-2 text-neutral-600"
            onClick={handleClearDraft}
            disabled={!hasDraft || isBusy}
          >
            <Trash2 className="h-4 w-4" />
            Clear Draft
          </Button>
        </div>

        <div className="mt-4 rounded-xl border bg-neutral-50 p-3 text-sm text-neutral-600">
          {customer ? (
            <div className="space-y-1">
              <p className="font-medium text-neutral-900">
                Ready for {customer.fullName}
              </p>

              <p>
                Milk rows: {draftMilkRows.length} · Product rows:{" "}
                {draftProductRows.length}
              </p>
            </div>
          ) : (
            <p>Search a customer first to start adding entries.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function DraftSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-xl border bg-neutral-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </p>

      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DraftRow({
  title,
  subtitle,
  amount,
  badgeClassName,
  onRemove,
  disabled,
}: {
  title: string;
  subtitle: string;
  amount: number;
  badgeClassName: string;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
      <div className="min-w-0">
        <p className="truncate font-medium text-neutral-900">{title}</p>

        <p className="truncate text-xs text-neutral-500">{subtitle}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Badge className={badgeClassName}>
          {formatCurrency(amount)}
        </Badge>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-neutral-500"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${title}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}