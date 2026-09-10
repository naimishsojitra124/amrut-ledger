import { useState } from "react";

import { ReceiptText } from "lucide-react";

import PageHeader from "@/components/common/page-header";
import BillStatsCards from "@/components/bills/bills-stats-cards";
import BillsTable from "@/components/bills/bills-table";
import BillDetailsDrawer from "@/components/bills/bill-details-drawer";

export default function Bills() {
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function handleViewBill(billId: string) {
    setSelectedBillId(billId);
    setDrawerOpen(true);
  }

  function handleDrawerOpenChange(open: boolean) {
    setDrawerOpen(open);

    if (!open) {
      setSelectedBillId(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 overflow-y-auto px-3 py-3 sm:gap-5 sm:px-5">
      <PageHeader
        title="Bills"
        description="View bills, record payments and manage outstanding bills for all customers."
        icon={<ReceiptText className="h-5 w-5 text-[#266699] sm:h-6 sm:w-6" />}
      />

      <BillStatsCards />

      <BillsTable onViewBill={handleViewBill} />

      <BillDetailsDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
        billId={selectedBillId}
      />
    </div>
  );
}
