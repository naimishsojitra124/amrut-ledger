import { BadgeIndianRupee, FileText, ReceiptText, Wallet } from "lucide-react";

import { useBillsSummaryQuery } from "@/services/bill.service";

import { formatCurrency } from "@/utils/format-currency";

import { StatCard } from "../StatCards";

export default function BillStatsCards() {
  const { data: stats, isPending } = useBillsSummaryQuery();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      <StatCard
        title="Total Bills"
        value={String(stats?.totalBills ?? 0)}
        isLoading={isPending}
        icon={<ReceiptText className="h-5 w-5 text-blue-600" />}
      />

      <StatCard
        title="Total Billed"
        value={formatCurrency(stats?.grandTotal ?? 0)}
        isLoading={isPending}
        icon={<FileText className="h-5 w-5 text-emerald-600" />}
      />

      <StatCard
        title="Total Paid"
        value={formatCurrency(stats?.totalPaid ?? 0)}
        isLoading={isPending}
        icon={<BadgeIndianRupee className="h-5 w-5 text-orange-500" />}
      />

      <StatCard
        title="Outstanding"
        value={formatCurrency(stats?.outstandingAmount ?? 0)}
        isLoading={isPending}
        icon={<Wallet className="h-5 w-5 text-violet-600" />}
      />
    </div>
  );
}
