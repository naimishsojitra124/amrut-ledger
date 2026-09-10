import { lazy, Suspense, useState } from "react";
import { CalendarDays, PencilLine, Phone } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QueryErrorState } from "@/components/common/query-error-state";

import { useCustomerQuery } from "@/services/customer.service";
import { useModalStore } from "@/store/modal.store";

import CustomerOverviewTab from "./tabs/customer-overview-tab";

const CustomerDailyHistoryTab = lazy(
  () => import("./tabs/customer-daily-history-tab"),
);

const CustomerBillsTab = lazy(() => import("./tabs/customer-bills-tab"));

const CustomerPaymentsTab = lazy(() => import("./tabs/customer-payments-tab"));

const CustomerAuditLogsTab = lazy(
  () => import("./tabs/customer-audit-logs-tab"),
);

const CustomerAccountTab = lazy(() => import("./tabs/customer-account-tab"));

type CustomerDetailsContentProps = {
  customerId: string | null;
};

function getInitials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function CustomerDetailsContent({
  customerId,
}: CustomerDetailsContentProps) {
  const [activeTab, setActiveTab] = useState("overview");

  const openCustomerEdit = useModalStore((state) => state.openCustomerEdit);

  const customerQuery = useCustomerQuery(customerId);

  const customer = customerQuery.data;

  if (!customerId) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-neutral-500">
        Select a customer to view details.
      </div>
    );
  }

  if (customerQuery.isPending) {
    return (
      <div
        className="space-y-5 px-4 py-5 sm:px-6"
        aria-label="Loading customer details"
        aria-busy="true"
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <Skeleton className="h-16 w-16 shrink-0 rounded-full sm:h-20 sm:w-20" />

          <div className="min-w-0 space-y-2">
            <Skeleton className="h-5 w-36 sm:h-6 sm:w-40" />
            <Skeleton className="h-4 w-48 max-w-full sm:w-56" />
          </div>
        </div>

        <Skeleton className="h-10 w-full" />

        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (customerQuery.isError || !customer) {
    return (
      <QueryErrorState
        onRetry={() => void customerQuery.refetch()}
        className="h-full"
      />
    );
  }

  const cardNumber = customer.currentCard?.cardNumber ?? null;

  const initials = getInitials(customer.fullName);

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="shrink-0 border-b px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <Avatar className="h-14 w-14 shrink-0 sm:h-20 sm:w-20">
            <AvatarFallback className="text-lg font-medium sm:text-2xl">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[#266699] sm:text-lg">
                  Card #{cardNumber ?? "-"}
                </span>

                <h2 className="mt-0.5 truncate text-xl font-semibold text-neutral-900 sm:text-2xl">
                  {customer.fullName}
                </h2>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-fit shrink-0 gap-2 rounded-md"
                onClick={() => openCustomerEdit(customer.id)}
              >
                <PencilLine className="h-4 w-4" />
                <span className="hidden sm:inline">Edit Customer</span>
                <span className="sm:hidden">Edit</span>
              </Button>
            </div>

            <Badge
              className={
                customer.status === "active"
                  ? "mt-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                  : "mt-2 bg-neutral-100 text-neutral-600 hover:bg-neutral-100"
              }
            >
              {customer.status === "active" ? "Active" : "Closed"}
            </Badge>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-500 sm:text-sm">
              <span className="flex min-w-0 items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                <span className="truncate">{customer.mobileNumber}</span>
              </span>

              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                Joined on{" "}
                {new Date(customer.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-hidden md:overflow-hidden border-b px-3 sm:px-6 hide-scrollbar">
        <TabsList
          variant="line"
          className="w-max min-w-full justify-start gap-3 sm:gap-6"
        >
          <TabsTrigger
            value="overview"
            className="whitespace-nowrap data-active:text-[#266699] hover:text-[#1F527A]"
          >
            Overview
          </TabsTrigger>

          <TabsTrigger
            value="daily-history"
            className="whitespace-nowrap data-active:text-[#266699] hover:text-[#1F527A]"
          >
            Daily History
          </TabsTrigger>

          <TabsTrigger
            value="bills"
            className="whitespace-nowrap data-active:text-[#266699] hover:text-[#1F527A]"
          >
            Bills
          </TabsTrigger>

          <TabsTrigger
            value="payments"
            className="whitespace-nowrap data-active:text-[#266699] hover:text-[#1F527A]"
          >
            Payments
          </TabsTrigger>

          <TabsTrigger
            value="account"
            className="whitespace-nowrap data-active:text-[#266699] hover:text-[#1F527A]"
          >
            Account
          </TabsTrigger>

          <TabsTrigger
            value="audit-logs"
            className="whitespace-nowrap data-active:text-[#266699] hover:text-[#1F527A]"
          >
            Audit Logs
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
        <TabsContent value="overview" className="m-0">
          <CustomerOverviewTab
            customer={customer}
            onViewBills={() => setActiveTab("bills")}
            onViewLedger={() => setActiveTab("daily-history")}
            onViewAllActivity={() => setActiveTab("audit-logs")}
            onAddPayment={() => setActiveTab("payments")}
          />
        </TabsContent>

        {activeTab === "daily-history" && (
          <TabsContent value="daily-history" className="m-0">
            <Suspense fallback={<TabSkeleton />}>
              <CustomerDailyHistoryTab
                customerId={customer.id}
                outstandingAmount={customer.outstandingAmount}
              />
            </Suspense>
          </TabsContent>
        )}

        {activeTab === "bills" && (
          <TabsContent value="bills" className="m-0">
            <Suspense fallback={<TabSkeleton />}>
              <CustomerBillsTab
                customerId={customer.id}
                customer={{
                  id: customer.id,
                  fullName: customer.fullName,
                  cardNumber: customer.currentCard?.cardNumber,
                  depositAmount: customer.depositAmount,
                  mobile: customer.mobileNumber,
                  address: customer.address,
                }}
              />
            </Suspense>
          </TabsContent>
        )}

        {activeTab === "payments" && (
          <TabsContent value="payments" className="m-0">
            <Suspense fallback={<TabSkeleton />}>
              <CustomerPaymentsTab
                customerId={customer.id}
                customer={{
                  fullName: customer.fullName,
                  cardNumber: customer.currentCard?.cardNumber,
                  depositAmount: customer.depositAmount,
                }}
              />
            </Suspense>
          </TabsContent>
        )}

        {activeTab === "account" && (
          <TabsContent value="account" className="m-0">
            <Suspense fallback={<TabSkeleton />}>
              <CustomerAccountTab customerId={customer.id} />
            </Suspense>
          </TabsContent>
        )}

        {activeTab === "audit-logs" && (
          <TabsContent value="audit-logs" className="m-0">
            <Suspense fallback={<TabSkeleton />}>
              <CustomerAuditLogsTab customerId={customer.id} />
            </Suspense>
          </TabsContent>
        )}
      </div>
    </Tabs>
  );
}

function TabSkeleton() {
  return (
    <div className="space-y-3 p-1" aria-hidden="true">
      <Skeleton className="h-10 w-1/3" />
      <Skeleton className="h-56 w-full" />
    </div>
  );
}
