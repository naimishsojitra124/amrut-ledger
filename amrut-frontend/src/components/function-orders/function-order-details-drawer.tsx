import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Sheet, SheetContent } from "@/components/ui/sheet";

import { useMediaQuery } from "@/hooks/use-media-query";
import { BREAKPOINTS } from "@/lib/breakpoints";

import FunctionOrderDetailsContent from "./function-order-details-content";

import type { FunctionOrderListItemsResponse } from "@/types/function-order";

type FunctionOrderDetailsDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: FunctionOrderListItemsResponse | null;
};

export default function FunctionOrderDetailsDrawer({
  open,
  onOpenChange,
  order,
}: FunctionOrderDetailsDrawerProps) {
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-dvh max-h-dvh" aria-describedby={undefined}>
          <FunctionOrderDetailsContent
            order={order}
            onDeleted={() => onOpenChange(false)}
          />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="h-dvh w-full max-w-150 p-0 sm:w-150"
        aria-describedby={undefined}
      >
        <FunctionOrderDetailsContent
          order={order}
          onDeleted={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
