import { lazy, Suspense, useState } from "react";
import { Users } from "lucide-react";

import PageHeader from "@/components/common/page-header";
import CustomerStatsCards from "@/components/customers/customer-stats-cards";
import CustomerTable from "@/components/customers/customer-table";

const CustomerDetailsDrawer = lazy(
  () => import("@/components/customers/customer-details-drawer"),
);

const Customers = () => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  function handleViewCustomer(customerId: string) {
    setSelectedCustomerId(customerId);
    setDrawerOpen(true);
  }

  function handleDrawerOpenChange(open: boolean) {
    setDrawerOpen(open);

    if (!open) {
      setSelectedCustomerId(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 px-3 py-3 sm:gap-5 sm:px-5 sm:py-4 overflow-y-auto">
      <PageHeader
        title="Customers"
        description="Manage customer accounts, cards, deposits and billing history."
        icon={<Users className="h-5 w-5 text-[#266699] sm:h-6 sm:w-6" />}
      />

      <CustomerStatsCards />

      <div className="min-h-0 flex-1">
        <CustomerTable onViewCustomer={handleViewCustomer} />
      </div>

      {drawerOpen && selectedCustomerId && (
        <Suspense fallback={null}>
          <CustomerDetailsDrawer
            open={drawerOpen}
            onOpenChange={handleDrawerOpenChange}
            customerId={selectedCustomerId}
          />
        </Suspense>
      )}
    </div>
  );
};

export default Customers;