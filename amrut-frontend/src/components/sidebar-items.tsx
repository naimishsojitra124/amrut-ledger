import {
  CalendarDays,
  ClipboardPenLine,
  LayoutDashboard,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Permission } from "@/config/permissions";
import { PERMISSIONS } from "@/config/permissions";

export type SidebarItem = {
  id: string;
  title: string;
  value: string;
  path: string;
  icon: LucideIcon;
  isVisible?: boolean;
  /**
   * Hidden unless the user holds this. `null` means everyone signed in — the
   * dashboard and settings both show only what the viewer can already reach.
   */
  permission: Permission | null;
};

export const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    value: "dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    permission: null,
  },
  {
    id: "customers",
    title: "Customers",
    value: "customers",
    path: "/customers",
    icon: Users,
    permission: PERMISSIONS.CUSTOMER_VIEW,
  },
  {
    id: "quick-entry",
    title: "Quick Entry",
    value: "quick-entry",
    path: "/quick-entry",
    icon: ClipboardPenLine,
    permission: PERMISSIONS.LEDGER_ENTRY_CREATE,
  },
  {
    id: "bills",
    title: "Bills",
    value: "bills",
    path: "/bills",
    icon: ScrollText,
    permission: PERMISSIONS.BILL_VIEW,
  },
  {
    id: "function-orders",
    title: "Function Orders",
    value: "function-orders",
    path: "/function-orders",
    icon: CalendarDays,
    permission: PERMISSIONS.FUNCTION_ORDER_VIEW,
  },
  {
    id: "settings",
    title: "Settings",
    value: "settings",
    path: "/settings",
    icon: Settings,
    permission: null,
  },
];
