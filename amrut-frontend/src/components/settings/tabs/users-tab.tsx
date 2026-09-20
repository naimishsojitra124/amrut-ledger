import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CircleOff,
  PencilLine,
  Plus,
  Search,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import FilterSelect from "@/components/common/filter-select";
import { ActionTooltip } from "@/components/common/action-tooltip";

import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/permissions";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

import {
  useUsersQuery,
  useUserStatsQuery,
  useArchiveUserMutation,
  useRestoreUserMutation,
  type UserResponse,
  type UserRole,
  type UserStatus,
} from "@/services/user.service";

import { useModalStore } from "@/store/modal.store";
import UserFormModal from "@/components/modals/user-form-modal";

type RoleFilter = "all" | UserRole;
type StatusFilter = "all" | UserStatus;

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const ROLE_META: Record<
  UserRole,
  {
    label: string;
    badgeClassName: string;
    iconClassName: string;
    description: string;
  }
> = {
  owner: {
    label: "Owner",
    badgeClassName: "bg-violet-100 text-violet-700 hover:bg-violet-100",
    iconClassName: "text-violet-600",
    description: "Full access to all features, settings and data.",
  },
  manager: {
    label: "Manager",
    badgeClassName: "bg-blue-100 text-blue-700 hover:bg-blue-100",
    iconClassName: "text-blue-600",
    description: "Can manage customers, bills, payments and reports.",
  },
  employee: {
    label: "Employee",
    badgeClassName: "bg-amber-100 text-amber-700 hover:bg-amber-100",
    iconClassName: "text-amber-600",
    description: "Can add entries, view customers and collect payments.",
  },
  guest: {
    label: "Guest",
    badgeClassName: "bg-slate-100 text-slate-700 hover:bg-slate-100",
    iconClassName: "text-slate-600",
    description: "Can view limited information without making changes.",
  }
};

const STATUS_META: Record<
  UserStatus,
  {
    label: string;
    badgeClassName: string;
  }
> = {
  active: {
    label: "Active",
    badgeClassName: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  },
  inactive: {
    label: "Inactive",
    badgeClassName: "bg-neutral-100 text-neutral-600 hover:bg-neutral-100",
  },
};

export const AVATAR_CLASSES = [
  "bg-violet-200 text-violet-700",
  "bg-rose-200 text-rose-700",
  "bg-emerald-200 text-emerald-700",
  "bg-amber-200 text-amber-700",
  "bg-blue-200 text-blue-700",
];

function getInitials(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatLastLogin(date: string | null) {
  if (!date) {
    return "-";
  }

  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderPaginationItems(currentPage: number, pageCount: number) {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const items: Array<number | "..."> = [1];

  if (currentPage > 3) {
    items.push("...");
  }

  const start = Math.max(2, currentPage - 1);

  const end = Math.min(pageCount - 1, currentPage + 1);

  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }

  if (currentPage < pageCount - 2) {
    items.push("...");
  }

  items.push(pageCount);

  return items;
}

export default function UsersTab() {
  const { can } = usePermissions();
  const canCreateUser = can(PERMISSIONS.USER_CREATE);
  const canArchiveUser = can(PERMISSIONS.USER_ARCHIVE);
  const { openUserForm, openConfirmation } = useModalStore();

  const [searchText, setSearchText] = useState("");
  const searchQuery = useDebouncedValue(searchText);

  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [pageIndex, setPageIndex] = useState(0);

  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);

  const usersQuery = useUsersQuery({
    page: pageIndex + 1,
    limit: pageSize,
    search: searchQuery.trim() || undefined,
  });

  const statsQuery = useUserStatsQuery();
  const archiveUserMutation = useArchiveUserMutation();
  const restoreUserMutation = useRestoreUserMutation();

  const users = usersQuery.data?.items ?? [];

  const pageInfo = usersQuery.data?.pageInfo ?? {
    page: 1,
    limit: pageSize,
    totalItems: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };

  const stats = statsQuery.data ?? {
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    ownerCount: 0,
    managerCount: 0,
    employeeCount: 0,
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesRole = roleFilter === "all" || user.role === roleFilter;

      const matchesStatus =
        statusFilter === "all" || user.status === statusFilter;

      return matchesRole && matchesStatus;
    });
  }, [users, roleFilter, statusFilter]);

  const totalPages = Math.max(1, pageInfo.totalPages);

  const currentPageIndex = Math.min(pageIndex, totalPages - 1);

  const from = pageInfo.totalItems === 0 ? 0 : currentPageIndex * pageSize + 1;

  const to = Math.min(pageInfo.totalItems, (currentPageIndex + 1) * pageSize);

  const roleCounts = {
    owner: stats.ownerCount,
    manager: stats.managerCount,
    employee: stats.employeeCount,
  };

  useEffect(() => {
    setPageIndex(0);
  }, [searchQuery, roleFilter, statusFilter, pageSize]);

  useEffect(() => {
    if (pageIndex > totalPages - 1) {
      setPageIndex(Math.max(0, totalPages - 1));
    }
  }, [pageIndex, totalPages]);

  function handleAddUser() {
    if (!canCreateUser) {
      return;
    }

    openUserForm();
  }

  function handleEditUser(user: UserResponse) {
    openUserForm(user.id);
  }

  function handleToggleUserStatus(user: UserResponse) {
    const isActive = user.status === "active";

    if (!canArchiveUser) return;

    openConfirmation({
      title: `${isActive ? "Deactivate" : "Activate"} ${user.fullName}?`,
      description: isActive
        ? "This user will lose access to the application and active sessions will be revoked. You can activate the user again later."
        : "This user will regain access to the application.",
      confirmLabel: isActive ? "Deactivate" : "Activate",
      variant: isActive ? "destructive" : "default",
      successMessage: `${user.fullName} ${isActive ? "deactivated" : "activated"}`,
      onConfirm: () =>
        isActive
          ? archiveUserMutation.mutateAsync(user.id).then(() => undefined)
          : restoreUserMutation.mutateAsync(user.id).then(() => undefined),
    });
  }

  function goToPage(nextPageIndex: number) {
    setPageIndex(Math.min(Math.max(nextPageIndex, 0), totalPages - 1));
  }

  return (
    <>
      <div className="space-y-4 rounded-2xl border bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold text-neutral-900">
              Users &amp; Roles
            </h3>

            <p className="text-xs text-neutral-500">
              Manage users, their roles and access to the system.
            </p>
          </div>

          <Button
            type="button"
            onClick={handleAddUser}
            disabled={!canCreateUser}
            size="default"
          >
            <Plus className="h-4 w-4" />
            Add User
          </Button>
        </div>

        <div className="grid gap-3 px-3 sm:px-4 grid-cols-3">
          <div className="rounded-2xl border bg-[#F9FBFF] p-4">
            <div className="flex flex-col sm:flex-row items-center gap-2 text-sm font-medium text-neutral-600">
              <Users className="h-4 w-4 text-[#266699]" />
              Total Users
            </div>

            <div className="mt-2 text-2xl font-semibold text-neutral-900 text-center sm:text-left">
              {stats.totalUsers}
            </div>
          </div>

          <div className="rounded-2xl border bg-[#F9FBFF] p-4">
            <div className="flex flex-col sm:flex-row items-center gap-2 text-sm font-medium text-neutral-600">
              <UserRound className="h-4 w-4 text-[#266699]" />
              Active
            </div>

            <div className="mt-2 text-2xl font-semibold text-neutral-900 text-center sm:text-left">
              {stats.activeUsers}
            </div>
          </div>

          <div className="rounded-2xl border bg-[#F9FBFF] p-4">
            <div className="flex flex-col sm:flex-row items-center gap-2 text-sm font-medium text-neutral-600">
              <CircleOff className="h-4 w-4 text-[#266699]" />
              Inactive
            </div>

            <div className="mt-2 text-2xl font-semibold text-neutral-900 text-center sm:text-left">
              {stats.inactiveUsers}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-3 sm:px-4 lg:flex-row lg:items-end">
          <div className="relative w-full sm:max-w-xl lg:w-80">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500 sm:right-4 sm:h-5 sm:w-5" />

            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search by name, mobile or email..."
            />
          </div>

          <FilterSelect
            label="Role"
            className="w-full sm:w-40"
            triggerClassName="w-full sm:w-40"
            value={roleFilter}
            onValueChange={(value) => setRoleFilter(value as RoleFilter)}
          >
            <SelectItem value="all">All</SelectItem>

            <SelectItem value="owner">Owner</SelectItem>

            <SelectItem value="manager">Manager</SelectItem>

            <SelectItem value="employee">Employee</SelectItem>
          </FilterSelect>

          <FilterSelect
            label="Status"
            className="w-full sm:w-40"
            triggerClassName="w-full sm:w-40"
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectItem value="all">All</SelectItem>

            <SelectItem value="active">Active</SelectItem>

            <SelectItem value="inactive">Inactive</SelectItem>
          </FilterSelect>
        </div>

        <div className="px-3 pb-4 sm:px-4">
          <div className="overflow-hidden rounded-xl border">
            <div className="w-full overflow-x-auto">
              <Table className="min-w-215">
                <TableHeader className="bg-[#F6F6F6]">
                  <TableRow>
                    <TableHead className="w-16 p-3 text-center">#</TableHead>

                    <TableHead className="p-3 text-center">User Name</TableHead>

                    <TableHead className="p-3 text-center">
                      Mobile Number
                    </TableHead>

                    <TableHead className="p-3 text-center">Role</TableHead>

                    <TableHead className="p-3 text-center">Status</TableHead>

                    <TableHead className="p-3 text-center">
                      Last Login
                    </TableHead>

                    <TableHead className="p-3 text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {usersQuery.isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-28 text-center text-neutral-500"
                      >
                        Loading users...
                      </TableCell>
                    </TableRow>
                  ) : usersQuery.isError ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-28 text-center text-red-600"
                      >
                        {(usersQuery.error as Error)?.message ||
                          "Failed to load users."}
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length > 0 ? (
                    filteredUsers.map((user, index) => {
                      const rowNumber = currentPageIndex * pageSize + index + 1;

                      const avatarClass =
                        AVATAR_CLASSES[
                          (currentPageIndex * pageSize + index) %
                            AVATAR_CLASSES.length
                        ];

                      return (
                        <TableRow
                          key={user.id}
                          className="transition-colors hover:bg-neutral-50"
                        >
                          <TableCell className="p-3 text-center text-sm text-neutral-700">
                            {rowNumber}
                          </TableCell>

                          <TableCell className="p-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 shrink-0">
                                <AvatarFallback
                                  className={cn(
                                    "text-sm font-semibold",
                                    avatarClass,
                                  )}
                                >
                                  {getInitials(user.fullName)}
                                </AvatarFallback>
                              </Avatar>

                              <div className="min-w-0">
                                <p className="truncate font-semibold text-neutral-900">
                                  {user.fullName}
                                </p>

                                <p className="text-xs text-neutral-500">
                                  {ROLE_META[user.role]?.label}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="p-3 text-center text-sm text-neutral-700">
                            {user.mobileNumber}
                          </TableCell>

                          <TableCell className="p-3 text-center">
                            <Badge
                              className={ROLE_META[user.role]?.badgeClassName}
                            >
                              {ROLE_META[user.role]?.label}
                            </Badge>
                          </TableCell>

                          <TableCell className="p-3 text-center">
                            <Badge
                              className={
                                STATUS_META[user.status]?.badgeClassName
                              }
                            >
                              {STATUS_META[user.status]?.label}
                            </Badge>
                          </TableCell>

                          <TableCell className="p-3 text-center text-sm text-neutral-700">
                            {formatLastLogin(user.lastLoginAt)}
                          </TableCell>

                          <TableCell
                            className="p-3 text-center"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <ActionTooltip
                              label="Edit"
                              align="center"
                              side="bottom"
                            >
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => handleEditUser(user)}
                                aria-label={`Edit ${user.fullName}`}
                              >
                                <PencilLine className="h-4 w-4" />
                              </Button>
                            </ActionTooltip>

                            <ActionTooltip
                              label={
                                user.status === "active"
                                  ? "Deactivate"
                                  : "Activate"
                              }
                              align="center"
                              side="bottom"
                            >
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className={cn(
                                  "h-9 w-9",
                                  user.status === "active"
                                    ? "border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                    : "border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700",
                                )}
                                onClick={() => handleToggleUserStatus(user)}
                                disabled={
                                  !canArchiveUser ||
                                  archiveUserMutation.isPending ||
                                  restoreUserMutation.isPending
                                }
                                aria-label={`${user.status === "active" ? "Deactivate" : "Activate"} ${user.fullName}`}
                              >
                                {user.status === "active" ? (
                                  <CircleOff className="h-4 w-4" />
                                ) : (
                                  <RotateCcw className="h-4 w-4" />
                                )}
                              </Button>
                            </ActionTooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-28 text-center text-neutral-500"
                      >
                        No users found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 border-t p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-neutral-500">
                Showing {from} to {to} of {pageInfo.totalItems} users
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => goToPage(pageIndex - 1)}
                  disabled={!pageInfo.hasPreviousPage || usersQuery.isFetching}
                  aria-label="Previous page"
                >
                  <span className="text-lg leading-none">‹</span>
                </Button>

                {renderPaginationItems(currentPageIndex + 1, totalPages).map(
                  (item, index) =>
                    item === "..." ? (
                      <span
                        key={`ellipsis-${index}`}
                        className="px-1 text-sm text-neutral-500 sm:px-2"
                      >
                        ...
                      </span>
                    ) : (
                      <Button
                        key={item}
                        type="button"
                        variant={
                          currentPageIndex + 1 === item ? "default" : "outline"
                        }
                        className="h-9 w-9 p-0"
                        onClick={() => goToPage(item - 1)}
                        disabled={usersQuery.isFetching}
                      >
                        {item}
                      </Button>
                    ),
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => goToPage(pageIndex + 1)}
                  disabled={!pageInfo.hasNextPage || usersQuery.isFetching}
                  aria-label="Next page"
                >
                  <span className="text-lg leading-none">›</span>
                </Button>

                <Select
                  value={String(pageSize)}
                  onValueChange={(value) =>
                    setPageSize(
                      Number(value) as (typeof PAGE_SIZE_OPTIONS)[number],
                    )
                  }
                >
                  <SelectTrigger className="h-9 w-28">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option} / page
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 border-t pt-4">
            <div className="rounded-xl border bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h4 className="text-[15px] font-semibold text-neutral-900">
                    Roles &amp; Permissions
                  </h4>

                  <p className="text-xs text-neutral-500">
                    Define what each role can access in the system.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="link"
                  className="w-fit gap-1 px-0"
                >
                  View Permission Matrix
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-3">
                <RoleCard
                  role="owner"
                  count={roleCounts.owner}
                  icon={
                    <ShieldCheck
                      className={cn("h-5 w-5", ROLE_META.owner.iconClassName)}
                    />
                  }
                  description={ROLE_META.owner.description}
                />

                <RoleCard
                  role="manager"
                  count={roleCounts.manager}
                  icon={
                    <Users
                      className={cn("h-5 w-5", ROLE_META.manager.iconClassName)}
                    />
                  }
                  description={ROLE_META.manager.description}
                />

                <RoleCard
                  role="employee"
                  count={roleCounts.employee}
                  icon={
                    <UserRound
                      className={cn(
                        "h-5 w-5",
                        ROLE_META.employee.iconClassName,
                      )}
                    />
                  }
                  description={ROLE_META.employee.description}
                />
              </div>
            </div>

            <div className="rounded-xl border bg-white p-4">
              <div className="flex items-center gap-2 font-semibold text-neutral-900">
                <Sparkles className="h-4 w-4 text-[#266699]" />
                User Notes
              </div>

              <div className="mt-3 space-y-2 text-sm text-neutral-600">
                <p>
                  Users are now loaded from the database instead of mock data.
                </p>

                <p>
                  Role and status filters are applied to the currently loaded
                  page.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t px-3 py-3 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <p>
            Need help? Contact support on{" "}
            <a
              href="mailto:amrut.support@gmail.com"
              className="text-[#266699] hover:underline"
            >
              amrut.support@gmail.com
            </a>
          </p>

          <div className="flex items-center gap-2 text-[#266699]">
            <Sparkles className="h-4 w-4" />
            <span className="font-medium">Database-backed data</span>
          </div>
        </div>
      </div>

      <UserFormModal />
    </>
  );
}

function RoleCard({
  role,
  count,
  icon,
  description,
}: {
  role: UserRole;
  count: number;
  icon: React.ReactNode;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-50">
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <h5 className="text-sm font-semibold text-neutral-900">
            {ROLE_META[role]?.label}
          </h5>

          <p className="mt-1 text-xs leading-5 text-neutral-600">
            {description}
          </p>

          <Badge
            className={cn(
              "mt-3 h-6 rounded-md px-2 text-xs font-semibold",
              ROLE_META[role]?.badgeClassName,
            )}
          >
            {count} {count === 1 ? "User" : "Users"}
          </Badge>
        </div>
      </div>
    </div>
  );
}
