import {
  BadgeIndianRupee,
  CalendarDays,
  ClipboardPenLine,
  FilePlus2,
  FileText,
  ReceiptText,
  Search,
  UserPlus,
  UserRoundX,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { QueryErrorState } from "@/components/common/query-error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useBillsQuery, useBillsSummaryQuery } from "@/services/bill.service";
import { useCustomerStatsQuery } from "@/services/customer.service";
import {
  useFunctionOrderRemindersQuery,
  useFunctionOrdersQuery,
} from "@/services/function-order.service";
import {
  useRetrySystemJobMutation,
  useSystemJobsQuery,
} from "@/services/system-job.service";
import { useServiceHealthQuery } from "@/services/health.service";
import { formatCurrency } from "@/utils/format-currency";
import { formatDate } from "@/utils/format-date";

const CARD_CLASS =
  "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";

const QUICK_ACTIONS = [
  {
    label: "Quick Entry",
    to: "/quick-entry",
    icon: ClipboardPenLine,
  },
  {
    label: "Add Customer",
    to: "/customers",
    icon: UserPlus,
  },
  {
    label: "Generate Bills",
    to: "/bills",
    icon: FilePlus2,
  },
  {
    label: "Record Payment",
    to: "/bills",
    icon: BadgeIndianRupee,
  },
  {
    label: "Search Customer",
    to: "/customers",
    icon: Search,
  },
  {
    label: "View Bills",
    to: "/bills",
    icon: ReceiptText,
  },
] satisfies ReadonlyArray<{
  label: string;
  to: string;
  icon: LucideIcon;
}>;

const DATE_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default function Dashboard() {
  const { userName } = useAuth();

  const customers = useCustomerStatsQuery();
  const bills = useBillsSummaryQuery();

  const pendingBills = useBillsQuery({
    page: 1,
    limit: 5,
    status: "unpaid",
  });

  const health = useServiceHealthQuery();
  const functionOrders = useFunctionOrdersQuery();
  const prep = useFunctionOrderRemindersQuery();
  const jobs = useSystemJobsQuery();
  const retryJob = useRetrySystemJobMutation();

  const activeCustomers = customers.data?.totalActiveCustomers ?? 0;
  const closedCustomers = customers.data?.totalClosedCustomers ?? 0;
  const billSummary = bills.data;

  const upcomingOrders = useMemo(() => {
    const items = functionOrders.data?.items ?? [];

    return items
      .filter(
        (order) => order.status !== "cancelled" && order.status !== "completed",
      )
      .slice(0, 3);
  }, [functionOrders.data?.items]);

  // How many orders feed each prep day, so a total of 15 kg can be traced back.
  const ordersPerPrepDay = useMemo(() => {
    const counts = new Map<string, { orders: number; due: number }>();

    for (const day of prep.data?.days ?? []) {
      const running = counts.get(day.deliveryDate) ?? { orders: 0, due: 0 };

      running.orders += 1;
      if (day.dueForReminder) running.due += 1;

      counts.set(day.deliveryDate, running);
    }

    return counts;
  }, [prep.data?.days]);

  const today = useMemo(() => DATE_FORMATTER.format(new Date()), []);

  const businessOverviewError = customers.error ?? bills.error ?? undefined;

  return (
    <div className="mx-auto w-full max-w-380 space-y-4 px-3 py-4 sm:space-y-5 sm:px-5 sm:py-6 lg:px-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
            Good morning, {userName}! 👋
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Here&apos;s the overview of your business today.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-sm text-slate-600">
          <CalendarDays className="h-4 w-4 shrink-0" />
          <time dateTime={new Date().toISOString().slice(0, 10)}>{today}</time>
        </div>
      </header>

      {/* Metrics */}
      <section
        aria-label="Business metrics"
        className="grid gap-3 grid-cols-2 lg:grid-cols-4"
      >
        <Metric
          title="Total Active Customers"
          value={activeCustomers}
          caption="Active"
          icon={Users}
          iconClassName="bg-cyan-50 text-cyan-600"
          loading={customers.isPending}
        />

        <Metric
          title="Closed Customers"
          value={closedCustomers}
          caption="Total closed"
          icon={UserRoundX}
          iconClassName="bg-violet-50 text-violet-600"
          loading={customers.isPending}
        />

        <Metric
          title="Bills Pending"
          value={billSummary?.unpaidBills ?? 0}
          caption="Not yet paid"
          icon={FileText}
          iconClassName="bg-orange-50 text-orange-600"
          loading={bills.isPending}
        />

        <Metric
          title="Payments Received"
          value={formatCurrency(billSummary?.totalPaid ?? 0)}
          caption="This month"
          icon={Wallet}
          iconClassName="bg-emerald-50 text-emerald-600"
          loading={bills.isPending}
        />
      </section>

      {/* Upcoming orders */}
      <section className={CARD_CLASS}>
        <SectionHeader
          title="Upcoming Function Orders"
          description="Prepare orders scheduled soon."
          action="View all"
          to="/function-orders"
        />

        {functionOrders.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="hidden h-20 w-full rounded-xl sm:block" />
          </div>
        ) : functionOrders.isError ? (
          <QueryErrorState
            error={functionOrders.error}
            onRetry={() => void functionOrders.refetch()}
          />
        ) : upcomingOrders.length === 0 ? (
          <EmptyState message="No upcoming function orders." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingOrders.map((order) => {
              const delivery = order.deliveryDays[0];

              return (
                <div
                  key={order.id}
                  className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <p className="truncate font-medium text-slate-900">
                    {order.customerName}
                  </p>

                  <p className="mt-1 truncate text-sm text-slate-500">
                    {order.eventName || "Function order"}
                  </p>

                  {delivery && (
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(delivery.deliveryDate)}
                      {delivery.deliveryTime
                        ? ` · ${delivery.deliveryTime}`
                        : ""}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Items to prepare */}
      <section className={CARD_CLASS}>
        <SectionHeader
          title="Items to Prepare"
          description={
            prep.data
              ? `Everything due over the next ${prep.data.daysAhead} day${prep.data.daysAhead === 1 ? "" : "s"}, totalled per item.`
              : "Everything due over the next few days, totalled per item."
          }
          action="View all"
          to="/function-orders"
        />

        {prep.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="hidden h-32 w-full rounded-xl sm:block" />
          </div>
        ) : prep.isError ? (
          <QueryErrorState
            error={prep.error}
            onRetry={() => void prep.refetch()}
          />
        ) : (prep.data?.preparation.length ?? 0) === 0 ? (
          <EmptyState message="Nothing to prepare in the next few days." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {prep.data?.preparation.map((day) => {
              const counts = ordersPerPrepDay.get(day.deliveryDate);

              return (
                <div
                  key={day.deliveryDate}
                  className={`min-w-0 rounded-xl border p-3 ${
                    counts?.due
                      ? "border-amber-300 bg-amber-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-medium text-slate-900">
                      {relativeDayLabel(day.daysUntil)}
                    </p>

                    <p className="shrink-0 text-xs text-slate-500">
                      {formatDate(day.deliveryDate)}
                    </p>
                  </div>

                  {counts ? (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {counts.orders} order{counts.orders === 1 ? "" : "s"}
                      {counts.due ? ` · ${counts.due} due now` : ""}
                    </p>
                  ) : null}

                  <ul className="mt-2 space-y-1">
                    {day.items.map((item) => (
                      <li
                        key={`${item.itemName}-${item.unit}`}
                        className="flex items-baseline justify-between gap-3 text-sm"
                      >
                        <span className="min-w-0 truncate text-slate-700">
                          {item.itemName}
                        </span>

                        <span className="shrink-0 font-medium tabular-nums text-slate-900">
                          {formatQuantity(item.quantity)} {item.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Quick actions + overview */}
      <section className="grid gap-4 xl:grid-cols-2">
        <section className={CARD_CLASS}>
          <SectionTitle
            title="Quick Actions"
            description="Perform common tasks quickly."
          />

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {QUICK_ACTIONS.map(({ label, to, icon: Icon }) => (
              <QuickAction
                key={`${to}-${label}`}
                icon={Icon}
                label={label}
                to={to}
              />
            ))}
          </div>
        </section>

        <section className={CARD_CLASS}>
          <SectionTitle
            title="Business Overview"
            description="Live figures from your business records."
          />

          {customers.isError || bills.isError ? (
            <QueryErrorState
              error={businessOverviewError}
              onRetry={() => {
                void customers.refetch();
                void bills.refetch();
              }}
            />
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:gap-x-8">
              <Overview
                label="Total customers"
                value={activeCustomers + closedCustomers}
                icon={Users}
              />

              <Overview
                label="Bills pending"
                value={billSummary?.unpaidBills ?? 0}
                icon={FileText}
              />

              <Overview
                label="Closed customers"
                value={closedCustomers}
                icon={UserRoundX}
              />

              <Overview
                label="Payments received"
                value={formatCurrency(billSummary?.totalPaid ?? 0)}
                icon={Wallet}
              />

              <Overview
                label="Bills this month"
                value={billSummary?.totalBills ?? 0}
                icon={ReceiptText}
              />

              <Overview
                label="Outstanding"
                value={formatCurrency(billSummary?.outstandingAmount ?? 0)}
                icon={BadgeIndianRupee}
              />
            </div>
          )}

          <div className="mt-5 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-3 text-sm sm:px-4">
            <span className="text-slate-600">System status</span>

            <span
              className={
                health.data?.status === "ok"
                  ? "font-medium text-emerald-600"
                  : "font-medium text-red-600"
              }
            >
              {health.data?.status === "ok" ? "Connected" : "Checking service…"}
            </span>
          </div>
        </section>
      </section>

      {/* Pending bills */}
      <section className={CARD_CLASS}>
        <SectionHeader
          title="Pending Bills"
          description="Bills that still need payment."
          action="View all"
          to="/bills"
        />

        {pendingBills.isPending ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : pendingBills.isError ? (
          <QueryErrorState
            error={pendingBills.error}
            onRetry={() => void pendingBills.refetch()}
          />
        ) : pendingBills.data?.items.length ? (
          <div className="divide-y divide-slate-100">
            {pendingBills.data.items.map((bill) => (
              <div
                key={bill.id}
                className="flex min-w-0 items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    {bill.customer.fullName}
                  </p>

                  <p className="truncate text-xs text-slate-500">
                    {bill.billNumber}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="font-semibold text-red-600">
                    {formatCurrency(bill.outstandingAmount)}
                  </p>

                  <p className="text-xs text-orange-600">Pending</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No pending bills." />
        )}
      </section>

      {/* Scheduled jobs */}
      <section className={CARD_CLASS}>
        <SectionTitle
          title="Scheduled Jobs"
          description="Scheduler status and last known result."
        />

        {jobs.isPending ? (
          <div className="grid gap-2 md:grid-cols-2">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : jobs.isError ? (
          <QueryErrorState
            error={jobs.error}
            onRetry={() => void jobs.refetch()}
          />
        ) : jobs.data?.items.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {jobs.data.items.map((job) => (
              <div
                key={job.id}
                className="min-w-0 rounded-lg border border-slate-200 p-3 text-sm"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <p className="min-w-0 truncate font-medium text-slate-900">
                    {job.name}
                  </p>

                  <span className="shrink-0 text-xs font-medium text-slate-500">
                    {job.status}
                  </span>
                </div>

                <p className="mt-1 truncate text-slate-500">{job.schedule}</p>

                {job.failureReason && (
                  <p className="mt-2 wrap-break-word text-xs text-amber-700">
                    {job.failureReason}
                  </p>
                )}

                <button
                  type="button"
                  disabled={retryJob.isPending}
                  onClick={() => retryJob.mutate(job.id)}
                  className="mt-2 text-xs font-medium text-[#266699] transition hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {retryJob.isPending ? "Retrying…" : "Retry job"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No scheduled jobs." />
        )}
      </section>
    </div>
  );
}

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
        {title}
      </h2>

      <p className="mt-0.5 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function SectionHeader({
  title,
  description,
  action,
  to,
}: {
  title: string;
  description: string;
  action: string;
  to: string;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <SectionTitle title={title} description={description} />

      <Link
        to={to}
        className="shrink-0 text-sm font-medium text-[#266699] hover:underline"
      >
        {action}
      </Link>
    </div>
  );
}

function Metric({
  title,
  value,
  caption,
  icon: Icon,
  iconClassName,
  loading,
}: {
  title: string;
  value: string | number;
  caption: string;
  icon: LucideIcon;
  iconClassName: string;
  loading: boolean;
}) {
  return (
    <div className={CARD_CLASS}>
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full sm:h-11 sm:w-11 ${iconClassName}`}
        >
          <Icon className="h-5 w-5" />
        </span>

        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-500">{title}</p>

          {loading ? (
            <Skeleton className="mt-2 h-7 w-20" />
          ) : (
            <p className="mt-1 truncate text-xl font-bold text-slate-950 sm:text-2xl">
              {value}
            </p>
          )}

          <p className="mt-1 text-xs text-slate-500">{caption}</p>
        </div>
      </div>
    </div>
  );
}

function Overview({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
      <Icon className="h-5 w-5 shrink-0 text-[#266699]" />

      <div className="min-w-0">
        <p className="truncate text-xs text-slate-500">{label}</p>

        <p className="truncate font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  to,
}: {
  icon: LucideIcon;
  label: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="flex min-h-24 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-sm font-medium text-slate-700 transition-colors hover:border-[#266699] hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#266699] focus-visible:ring-offset-2 sm:min-h-27"
    >
      <Icon className="mb-2 h-5 w-5 text-[#266699]" />
      <span className="leading-tight">{label}</span>
    </Link>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="py-10 text-center text-sm text-slate-500">{message}</p>;
}

function relativeDayLabel(daysUntil: number) {
  if (daysUntil <= 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  return `In ${daysUntil} days`;
}

// Goods are sold by weight, so 9 shows as "9" and 9.5 as "9.5".
function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, "");
}

