import { useMemo } from "react";

import { BadgeIndianRupee, FileText, ReceiptText, Wallet } from "lucide-react";

import { formatBusinessMonth, previousBusinessMonth } from "@/config/business";
import { useBillsSummaryQuery } from "@/services/bill.service";

import { formatCurrency } from "@/utils/format-currency";

import { StatCard } from "../StatCards";

export default function BillStatsCards() {
  const period = useMemo(() => previousBusinessMonth(), []);
  const periodLabel = useMemo(() => formatBusinessMonth(period), [period]);

  const { data: stats, isPending, isError } = useBillsSummaryQuery(period);

  const money = (amount: number | undefined) =>
    isError ? "-" : formatCurrency(amount ?? 0);

  const broughtForward = stats?.previousDue ?? 0;
  const carriedForward = stats?.carriedForwardAmount ?? 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      <StatCard
        title="Cards Billed"
        value={isError ? "-" : String(stats?.totalBills ?? 0)}
        subTitle={periodLabel}
        isLoading={isPending}
        icon={<ReceiptText className="h-5 w-5 text-blue-600" />}
      />

      <StatCard
        title="Total Billed"
        value={money(stats?.billedAmount)}
        subTitle={
          broughtForward > 0
            ? `incl. ${formatCurrency(broughtForward)} brought forward`
            : periodLabel
        }
        isLoading={isPending}
        icon={<FileText className="h-5 w-5 text-emerald-600" />}
      />

      <StatCard
        title="Collected"
        value={money(stats?.totalPaid)}
        subTitle={periodLabel}
        isLoading={isPending}
        icon={<BadgeIndianRupee className="h-5 w-5 text-orange-500" />}
      />

      <StatCard
        title="Outstanding"
        value={money(stats?.outstandingAmount)}
        subTitle={
          carriedForward > 0
            ? `${formatCurrency(carriedForward)} more moved to a later bill`
            : "Still to collect"
        }
        isLoading={isPending}
        icon={<Wallet className="h-5 w-5 text-violet-600" />}
      />
    </div>
  );
}
