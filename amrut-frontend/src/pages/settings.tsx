import { useMemo } from "react";
import {
  CreditCard,
  Milk,
  Package2,
  Settings as SettingsIcon,
  Users,
} from "lucide-react";

import PageHeader from "@/components/common/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CardTab from "@/components/settings/tabs/card-tab";
import MilkTypesTab from "@/components/settings/tabs/milk-types-tab";
import ProductSuggestionsTab from "@/components/settings/tabs/product-suggestion-tab";
import UsersTab from "@/components/settings/tabs/users-tab";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS, type Permission } from "@/config/permissions";
import { cn } from "@/lib/utils";

const TAB_TRIGGER_CLASS =
  "min-w-35 whitespace-nowrap text-sm gap-2 data-active:text-[#266699] hover:text-[#1F527A] sm:min-w-0 p-0";

type SettingsTab = {
  value: string;
  label: string;
  icon: typeof Milk;
  permission: Permission;
  content: () => React.ReactNode;
};

const TABS: SettingsTab[] = [
  {
    value: "milk-types",
    label: "Milk Types",
    icon: Milk,
    permission: PERMISSIONS.MILK_TYPE_VIEW,
    content: () => <MilkTypesTab />,
  },
  {
    value: "products",
    label: "Products (Suggestions)",
    icon: Package2,
    permission: PERMISSIONS.PRODUCT_SUGGESTION_VIEW,
    content: () => <ProductSuggestionsTab />,
  },
  {
    value: "cards",
    label: "Cards",
    icon: CreditCard,
    permission: PERMISSIONS.CARD_VIEW,
    content: () => <CardTab />,
  },
  {
    value: "users",
    label: "Users & Roles",
    icon: Users,
    permission: PERMISSIONS.USER_VIEW,
    content: () => <UsersTab />,
  },
];

export default function Settings() {
  const { can } = usePermissions();

  // Only the tabs this user can actually open. Showing "Users & Roles" to
  // someone who would just be refused is worse than not showing it.
  const visibleTabs = useMemo(
    () => TABS.filter((tab) => can(tab.permission)),
    [can],
  );

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3 px-3 py-2 sm:gap-4 sm:px-4 lg:px-5">
      <PageHeader
        title="Settings"
        description="Manage business configurations and preferences."
        icon={<SettingsIcon className="h-6 w-6 text-[#266699]" />}
      />

      {visibleTabs.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-neutral-500">
          There are no settings available to your account.
        </div>
      ) : (
        <Tabs
          defaultValue={visibleTabs[0]!.value}
          className="flex flex-1 flex-col gap-3 items-center justify-center"
        >
          <div className="w-full rounded-[12px] border bg-white shadow-sm p-2 hide-scrollbar overflow-auto">
            <TabsList
              variant="line-flush"
              className={cn(
                "flex h-16 min-w-max gap-1 sm:w-full sm:min-w-0",
                visibleTabs.length > 1 && "sm:grid",
                visibleTabs.length === 2 && "sm:grid-cols-2",
                visibleTabs.length === 3 && "sm:grid-cols-3",
                visibleTabs.length === 4 && "sm:grid-cols-4",
              )}
            >
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;

                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className={TAB_TRIGGER_CLASS}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <div className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto hide-scrollbar">
            {visibleTabs.map((tab) => (
              <TabsContent
                key={tab.value}
                value={tab.value}
                className="m-0 h-full w-full"
              >
                {tab.content()}
              </TabsContent>
            ))}
          </div>
        </Tabs>
      )}
    </div>
  );
}
