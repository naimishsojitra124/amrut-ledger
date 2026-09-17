import type { FormEvent } from "react";

import {
  CalendarDays,
  CircleCheckBig,
  CreditCard,
  Loader2,
  Phone,
  Search,
  Wallet,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/common/date-picker";

import type { Customer } from "@/types/customer";
import type { DailyLedgerResponse } from "@/services/daily-ledger.service";

import { formatCurrency } from "@/utils/format-currency";

type QuickEntryCustomerCardProps = {
  cardNumber: string;
  onCardNumberChange: (value: string) => void;
  onSearch: () => void;
  isSearching?: boolean;
  selectedDate: string;
  onDateChange: (value: string) => void;
  customer: Customer | null;
  ledger?: DailyLedgerResponse | null;
};

function getInitials(fullName: string) {
  return (
    fullName
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "C"
  );
}

export default function QuickEntryCustomerCard({
  cardNumber,
  onCardNumberChange,
  onSearch,
  isSearching = false,
  selectedDate,
  onDateChange,
  customer,
  ledger,
}: QuickEntryCustomerCardProps) {
  const customerOutstanding = customer?.outstandingAmount ?? 0;
  const currentCardNumber = customer?.currentCard?.cardNumber ?? null;

  const primaryMilk =
    customer?.milkTypes.find((item) => item.isDefault) ??
    customer?.milkTypes[0] ??
    null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch();
  }

  return (
    <section className="grid gap-3 rounded-2xl border bg-white p-3 shadow-sm lg:grid-cols-[minmax(260px,0.9fr)_minmax(320px,1.25fr)] lg:p-4 xl:grid-cols-[minmax(260px,0.9fr)_minmax(360px,1.25fr)_minmax(220px,0.7fr)]">
      <form
        onSubmit={handleSubmit}
        className="flex min-w-0 flex-col gap-3 lg:border-r lg:pr-4"
      >
        <div className="space-y-2">
          <label
            htmlFor="quick-entry-card-number"
            className="block text-sm font-medium text-neutral-800"
          >
            Enter Card Number
          </label>

          <div className="relative">
            <CreditCard className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />

            <Input
              id="quick-entry-card-number"
              value={cardNumber}
              onChange={(event) => onCardNumberChange(event.target.value)}
              placeholder="e.g. 129"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="h-11 pl-10 pr-4 text-[15px]"
              disabled={isSearching}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-800">
            Entry Date
          </label>

          <DatePicker
            value={selectedDate}
            onChange={onDateChange}
            className="h-11"
            disabled={isSearching}
          />
        </div>

        <div className="flex min-h-10 items-center gap-2 text-sm">
          {customer ? (
            <>
              <CircleCheckBig className="h-4 w-4 shrink-0 text-emerald-600" />

              <span className="font-medium text-emerald-700">
                {ledger ? "Ledger loaded for selected date" : "Customer found"}
              </span>
            </>
          ) : (
            <>
              <CircleCheckBig className="h-4 w-4 shrink-0 text-neutral-300" />

              <span className="text-neutral-500">
                Search a card number to load customer details
              </span>
            </>
          )}
        </div>

        <Button
          type="submit"
          className="h-11 w-full rounded-md"
          disabled={isSearching}
        >
          {isSearching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Search
            </>
          )}
        </Button>
      </form>

      <div className="min-w-0 border-t pt-3 lg:border-t-0 lg:pt-0">
        {customer ? (
          <div className="flex h-full flex-col justify-center gap-4 lg:px-1">
            <div className="flex min-w-0 items-start gap-3">
              <Avatar className="h-16 w-16 shrink-0 sm:h-20 sm:w-20">
                <AvatarFallback className="bg-neutral-300 text-lg font-semibold text-white sm:text-xl">
                  {getInitials(customer.fullName)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-blue-600 sm:text-lg">
                    Card #{currentCardNumber ?? "-"}
                  </span>

                  <Badge
                    className={
                      customer.status === "active"
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-100"
                    }
                  >
                    {customer.status === "active" ? "Active" : "Closed"}
                  </Badge>
                </div>

                <h3 className="mt-1 truncate text-lg font-bold text-neutral-900 sm:text-xl">
                  {customer.fullName}
                </h3>

                <Badge className="mt-2 max-w-full rounded-md bg-blue-50 px-3 py-1 font-medium text-blue-700 hover:bg-blue-50">
                  <span className="truncate">
                    Default Milk: {primaryMilk?.milkTypeName ?? "-"}
                  </span>
                </Badge>
              </div>
            </div>

            <div className="grid gap-2 text-sm text-neutral-600 sm:grid-cols-2">
              <div className="flex min-w-0 items-center gap-2">
                <Wallet className="h-4 w-4 shrink-0 text-neutral-500" />

                <span className="truncate">
                  Deposit:{" "}
                  <span className="font-medium">
                    {formatCurrency(customer.depositAmount)}
                  </span>
                </span>
              </div>

              <div className="flex min-w-0 items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-neutral-500" />

                <span className="truncate">
                  Mobile:{" "}
                  <span className="font-medium">{customer.mobileNumber}</span>
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-32 items-center justify-center px-2 py-4 text-center">
            <div>
              <CalendarDays className="mx-auto h-7 w-7 text-neutral-300" />

              <span className="mt-2 block text-sm font-medium text-neutral-900">
                No customer loaded
              </span>

              <span className="mt-1 block text-sm text-neutral-500">
                Search by card number to view customer details.
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="min-w-0 border-t pt-3 xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
        {customer ? (
          <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 rounded-2xl bg-neutral-50 px-4 py-4 text-center">
            <span className="text-sm font-semibold text-neutral-700">
              Outstanding Balance
            </span>

            <span
              className={
                customerOutstanding > 0
                  ? "text-3xl font-semibold text-red-600"
                  : "text-3xl font-semibold text-emerald-600"
              }
            >
              {formatCurrency(customerOutstanding)}
            </span>

            <div className="text-sm text-neutral-600">
              {customer.lastEntryAt ? (
                <p>
                  Last Entry:{" "}
                  <span className="font-medium">
                    {new Intl.DateTimeFormat("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(customer.lastEntryAt))}
                  </span>
                </p>
              ) : (
                <p>No entry recorded yet</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-h-32 items-center justify-center rounded-2xl bg-neutral-50 px-4 py-6 text-center">
            <p className="text-sm text-neutral-500">
              Outstanding summary will appear here after search.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
