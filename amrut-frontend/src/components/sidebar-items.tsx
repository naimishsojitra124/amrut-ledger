import {
  CalendarDays,
  ClipboardPenLine,
  LayoutDashboard,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type SidebarItem = {
  id: string;
  title: string;
  value: string;
  path: string;
  icon: LucideIcon;
  isVisible?: boolean;
};

export const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    value: "dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "customers",
    title: "Customers",
    value: "customers",
    path: "/customers",
    icon: Users,
  },
  {
    id: "quick-entry",
    title: "Quick Entry",
    value: "quick-entry",
    path: "/quick-entry",
    icon: ClipboardPenLine,
  },
  {
    id: "bills",
    title: "Bills",
    value: "bills",
    path: "/bills",
    icon: ScrollText,
  },
  {
    id: "function-orders",
    title: "Function Orders",
    value: "function-orders",
    path: "/function-orders",
    icon: CalendarDays,
  },
  {
    id: "settings",
    title: "Settings",
    value: "settings",
    path: "/settings",
    icon: Settings,
  },
];
