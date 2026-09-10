import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { BREAKPOINTS } from "@/lib/breakpoints";

import CustomerDetailsContent from "./customer-details-content";

type CustomerDetailsDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string | null;
};

export default function CustomerDetailsDrawer({
  open,
  onOpenChange,
  customerId,
}: CustomerDetailsDrawerProps) {
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className="h-dvh max-h-dvh p-0"
          aria-describedby={undefined}
        >
          <CustomerDetailsContent customerId={customerId} />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="h-full w-full max-w-150 p-0 sm:w-150 [&>button]:hidden"
        aria-describedby={undefined}
      >
        <CustomerDetailsContent customerId={customerId} />
      </SheetContent>
    </Sheet>
  );
}
