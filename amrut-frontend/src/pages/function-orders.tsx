import { useState } from "react";

import { CalendarDays } from "lucide-react";

import PageHeader from "@/components/common/page-header";
import FunctionOrderTable from "@/components/function-orders/function-order-table";
import FunctionOrderDetailsDrawer from "@/components/function-orders/function-order-details-drawer";

import type { FunctionOrderListItemsResponse } from "@/types/function-order";
import NewFunctionOrderForm from "@/components/function-orders/new-function-order-form";

export default function FunctionOrders() {
  const [
    selectedFunctionOrder,
    setSelectedFunctionOrder,
  ] = useState<FunctionOrderListItemsResponse | null>(
    null,
  );

  const [drawerOpen, setDrawerOpen] =
    useState(false);

  function handleViewFunctionOrder(
    order: FunctionOrderListItemsResponse,
  ) {
    setSelectedFunctionOrder(order);
    setDrawerOpen(true);
  }

  function handleDrawerOpenChange(open: boolean) {
    setDrawerOpen(open);

    if (!open) {
      setSelectedFunctionOrder(null);
    }
  }

  return (
    <div className="flex w-full flex-col gap-4 overflow-y-auto px-3 py-3 sm:gap-5 sm:px-5 sm:py-4">
      <PageHeader
        title="Function Orders"
        description="Plan multi-day orders, returns, reminders, and printable order bills."
        icon={
          <CalendarDays className="h-5 w-5 text-[#266699] sm:h-6 sm:w-6" />
        }
      />

      <NewFunctionOrderForm />

      <FunctionOrderTable
        onViewFunctionOrder={
          handleViewFunctionOrder
        }
      />

      <FunctionOrderDetailsDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
        order={selectedFunctionOrder}
      />
    </div>
  );
}