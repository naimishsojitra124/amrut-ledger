import {
  Ban,
  CalendarDays,
  CreditCard,
  Droplets,
  Info,
  MapPin,
  Phone,
  Plus,
  RotateCcw,
  SquareChartGantt,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";

import { formatCurrency } from "@/utils/format-currency";
import type { Customer } from "@/types/customer";
import { useRestoreCustomerMutation } from "@/services/customer.service";
import { useModalStore } from "@/store/modal.store";

type CustomerOverviewTabProps = {
  customer: Customer;
  onAddPayment?: () => void;
  onViewBills?: () => void;
  onViewLedger?: () => void;
  onViewAllActivity?: () => void;
};

function InfoCard({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg border bg-[#F6F6F6] p-3 text-center sm:p-4">
      <span className="max-w-full truncate text-xs font-semibold text-neutral-700">
        {label}
      </span>

      <span className={cn("max-w-full truncate font-semibold", valueClassName)}>
        {value}
      </span>
    </div>
  );
}

export default function CustomerOverviewTab({
  customer,
  onAddPayment,
  onViewBills,
  onViewLedger,
}: CustomerOverviewTabProps) {
  const openCustomerCloseConfirm = useModalStore(
    (state) => state.openCustomerCloseConfirm,
  );
  const openConfirmation = useModalStore((state) => state.openConfirmation);
  const restoreCustomerMutation = useRestoreCustomerMutation();

  const primaryMilk = customer.milkTypes.find((milk) => milk.isDefault) ?? null;

  const otherMilkTypes = customer.milkTypes.filter((milk) => !milk.isDefault);

  return (
    <div className="space-y-3">
      <section className="rounded-lg border px-3 py-3">
        <h3 className="font-semibold text-[#266699]">Account Summary</h3>

        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
          <InfoCard
            label="Deposit Amount"
            value={formatCurrency(customer.depositAmount)}
            valueClassName="text-emerald-600"
          />

          <InfoCard
            label="Outstanding"
            value={formatCurrency(customer.outstandingAmount)}
            valueClassName={
              customer.outstandingAmount > 0
                ? "text-red-500"
                : "text-emerald-600"
            }
          />

          <InfoCard
            label="Current Card"
            value={customer.currentCard?.cardNumber?.toString() ?? "-"}
          />

          <InfoCard
            label="Primary Milk"
            value={primaryMilk?.milkTypeName ?? "-"}
            valueClassName="rounded-md bg-blue-50 px-3 py-1 text-[#266699]"
          />

          <InfoCard
            label="Milk Types"
            value={String(customer.milkTypes.length)}
          />

          <InfoCard
            label="Status"
            value={customer.status === "active" ? "Active" : "Closed"}
            valueClassName={cn(
              "rounded-md px-3 py-1",
              customer.status === "active"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-600",
            )}
          />
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border px-3 py-3">
          <div className="mb-3 flex items-center gap-2">
            <Wallet className="h-4 w-4 shrink-0 text-[#266699]" />
            <h3 className="font-semibold text-[#266699]">
              Customer Information
            </h3>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-start justify-between gap-4">
              <span className="shrink-0 text-neutral-500">Full Name</span>

              <span className="min-w-0 max-w-[65%] wrap-break-word text-right font-medium text-neutral-800">
                {customer.fullName}
              </span>
            </div>

            <div className="flex items-start justify-between gap-4">
              <span className="flex shrink-0 items-center gap-2 text-neutral-500">
                <Phone className="h-4 w-4" />
                Mobile
              </span>

              <span className="break-all text-right font-medium text-neutral-800">
                {customer.mobileNumber || "-"}
              </span>
            </div>

            <div className="flex items-start justify-between gap-4">
              <span className="flex shrink-0 items-center gap-2 text-neutral-500">
                <MapPin className="h-4 w-4" />
                Address
              </span>

              <span className="min-w-0 max-w-[65%] wrap-break-word text-right font-medium text-neutral-800">
                {customer.address || "-"}
              </span>
            </div>

            <div className="flex items-start justify-between gap-4">
              <span className="flex shrink-0 items-center gap-2 text-neutral-500">
                <CalendarDays className="h-4 w-4" />
                Joined
              </span>

              <span className="text-right font-medium text-neutral-800">
                {new Date(customer.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border px-3 py-3">
          <div className="mb-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4 shrink-0 text-[#266699]" />
            <h3 className="font-semibold text-[#266699]">Card Information</h3>
          </div>

          {customer.currentCard ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-neutral-500">Card Number</span>

                <Badge className="shrink-0 bg-blue-50 text-[#266699] hover:bg-blue-50">
                  #{customer.currentCard.cardNumber}
                </Badge>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-neutral-500">Status</span>

                <Badge className="shrink-0 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                  Assigned
                </Badge>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-neutral-500">Assigned On</span>

                <span className="text-right font-medium text-neutral-800">
                  {new Date(customer.currentCard.assignedAt).toLocaleDateString(
                    "en-IN",
                    {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    },
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-neutral-500">Deposit at Assignment</span>

                <span className="text-right font-semibold text-neutral-800">
                  {formatCurrency(customer.currentCard.depositAtAssignment)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex min-h-28 items-center justify-center text-center text-sm text-neutral-500">
              No card currently assigned.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border px-3 py-3">
        <div className="mb-3 flex items-center gap-2">
          <Droplets className="h-4 w-4 shrink-0 text-[#266699]" />
          <h3 className="font-semibold text-[#266699]">Milk Types</h3>
        </div>

        {customer.milkTypes.length > 0 ? (
          <div className="space-y-2">
            {primaryMilk ? (
              <div className="flex flex-col gap-2 rounded-md bg-blue-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="font-medium text-[#266699]">
                    {primaryMilk.milkTypeName}
                  </span>

                  <Badge className="bg-blue-100 text-[#266699] hover:bg-blue-100">
                    Primary
                  </Badge>
                </div>

                <span className="shrink-0 font-semibold text-[#266699]">
                  {formatCurrency(primaryMilk.rate)}
                  /Ltr
                </span>
              </div>
            ) : null}

            {otherMilkTypes.map((milk) => (
              <div
                key={milk.milkTypeId}
                className="flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="font-medium text-neutral-700">
                    {milk.milkTypeName}
                  </span>

                  <Badge
                    variant="secondary"
                    className="bg-neutral-100 text-neutral-600"
                  >
                    Additional
                  </Badge>
                </div>

                <span className="shrink-0 font-semibold text-neutral-800">
                  {formatCurrency(milk.rate)}
                  /Ltr
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-h-24 items-center justify-center text-center text-sm text-neutral-500">
            No milk types assigned.
          </div>
        )}
      </section>

      <section className="rounded-lg border px-3 py-3">
        <h3 className="font-semibold text-[#266699]">Quick Actions</h3>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            className="h-auto min-h-11 justify-start gap-2 rounded-md px-3 py-2 text-left"
            type="button"
            onClick={onAddPayment}
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="truncate">Add Payment</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto min-h-11 justify-start gap-2 rounded-md px-3 py-2 text-left"
            type="button"
            onClick={onViewBills}
          >
            <SquareChartGantt className="h-4 w-4 shrink-0" />
            <span className="truncate">View Bills</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto min-h-11 justify-start gap-2 rounded-md px-3 py-2 text-left"
            type="button"
            onClick={onViewLedger}
          >
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span className="truncate">View Ledger</span>
          </Button>

          {customer.status === "active" ? (
            <Button
              variant="outline"
              className="h-auto min-h-11 justify-start gap-2 rounded-md bg-transparent px-3 py-2 text-left text-red-600 hover:bg-red-50 hover:text-red-500"
              type="button"
              onClick={() =>
                openCustomerCloseConfirm({
                  customerId: customer.id,
                  customerName: customer.fullName,
                  depositAmount: customer.depositAmount,
                })
              }
            >
              <Ban className="h-4 w-4 shrink-0" />
              <span className="truncate">Close Customer</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              className="h-auto min-h-11 justify-start gap-2 rounded-md bg-transparent px-3 py-2 text-left text-emerald-600 hover:bg-emerald-100 hover:text-emerald-600"
              type="button"
              disabled={restoreCustomerMutation.isPending}
              onClick={() =>
                openConfirmation({
                  title: `Reopen ${customer.fullName}?`,
                  description: "This customer will become active again and can be used in normal customer workflows.",
                  confirmLabel: "Reopen Customer",
                  successMessage: "Customer reopened",
                  onConfirm: () => restoreCustomerMutation.mutateAsync(customer.id).then(() => undefined),
                })
              }
            >
              <RotateCcw className="h-4 w-4 shrink-0" />
              <span className="truncate">Reopen Customer</span>
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-blue-50 px-3 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <span className="flex shrink-0 items-center gap-1.5 font-semibold text-[#266699]">
            <Info className="h-5 w-5" />
            Notes
          </span>

          <p className="min-w-0 whitespace-pre-wrap wrap-break-word text-sm leading-5 text-neutral-600">
            {customer.notes || "No notes added."}
          </p>
        </div>
      </section>
    </div>
  );
}
