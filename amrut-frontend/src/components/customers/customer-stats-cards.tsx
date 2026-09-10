import { Users, UserX } from "lucide-react";

import { useCustomerStatsQuery } from "@/services/customer.service";

import { StatCard } from "../StatCards";

export default function CustomerStatsCards() {
  const { data, isPending, isError } = useCustomerStatsQuery();

  const activeCustomers = data?.totalActiveCustomers ?? 0;
  const closedCustomers = data?.totalClosedCustomers ?? 0;
  const totalCustomers = activeCustomers + closedCustomers;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="Total Customers"
        value={isError ? "-" : totalCustomers.toLocaleString("en-IN")}
        isLoading={isPending}
        icon={<Users className="h-5 w-5 text-amber-500" />}
      />

      <StatCard
        title="Active Customers"
        value={isError ? "-" : activeCustomers.toLocaleString("en-IN")}
        isLoading={isPending}
        icon={<Users className="h-5 w-5 text-blue-600" />}
      />

      <StatCard
        title="Closed Customers"
        value={isError ? "-" : closedCustomers.toLocaleString("en-IN")}
        isLoading={isPending}
        icon={<UserX className="h-5 w-5 text-red-500" />}
      />
    </div>
  );
}
