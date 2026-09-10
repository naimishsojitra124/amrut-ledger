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

export default function Settings() {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3 px-3 py-2 sm:gap-4 sm:px-4 lg:px-5">
      <PageHeader
        title="Settings"
        description="Manage business configurations and preferences."
        icon={<SettingsIcon className="h-6 w-6 text-[#266699]" />}
      />

      <Tabs
        defaultValue="milk-types"
        className="flex flex-1 flex-col gap-3 items-center justify-center"
      >
        <div className="w-full rounded-[12px] border bg-white shadow-sm p-2 hide-scrollbar overflow-auto">
          <TabsList
            variant="line-flush"
            className="flex h-16 min-w-max gap-1 sm:grid sm:w-full sm:min-w-0 sm:grid-cols-4"
          >
            <TabsTrigger
              value="milk-types"
              className="min-w-35 whitespace-nowrap text-sm gap-2 data-active:text-[#266699] hover:text-[#1F527A] sm:min-w-0 p-0"
            >
              <Milk className="h-4 w-4 shrink-0" />
              <span>Milk Types</span>
            </TabsTrigger>

            <TabsTrigger
              value="products"
              className="min-w-35 whitespace-nowrap text-sm gap-2 data-active:text-[#266699] hover:text-[#1F527A] sm:min-w-0 p-0"
            >
              <Package2 className="h-4 w-4 shrink-0" />
              <span>Products (Suggestions)</span>
            </TabsTrigger>

            <TabsTrigger
              value="cards"
              className="min-w-35 whitespace-nowrap text-sm gap-2 data-active:text-[#266699] hover:text-[#1F527A] sm:min-w-0 p-0"
            >
              <CreditCard className="h-4 w-4 shrink-0" />
              <span>Cards</span>
            </TabsTrigger>

            <TabsTrigger
              value="users"
              className="min-w-35 whitespace-nowrap text-sm gap-2 data-active:text-[#266699] hover:text-[#1F527A] sm:min-w-0 p-0"
            >
              <Users className="h-4 w-4 shrink-0" />
              <span>Users &amp; Roles</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto hide-scrollbar">
          <TabsContent value="milk-types" className="m-0 h-full w-full">
            <MilkTypesTab />
          </TabsContent>

          <TabsContent value="products" className="m-0 h-full w-full">
            <ProductSuggestionsTab />
          </TabsContent>

          <TabsContent value="cards" className="m-0 h-full w-full">
            <CardTab />
          </TabsContent>

          <TabsContent value="users" className="m-0 h-full w-full">
            <UsersTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
