import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Sheet, SheetContent } from "@/components/ui/sheet";

import { useMediaQuery } from "@/hooks/use-media-query";
import { BREAKPOINTS } from "@/lib/breakpoints";

import BillDetailsContent from "./bill-details-content";

type BillDetailsDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billId: string | null;
};

export default function BillDetailsDrawer({
  open,
  onOpenChange,
  billId,
}: BillDetailsDrawerProps) {
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-dvh max-h-dvh" aria-describedby={undefined}>
          <BillDetailsContent billId={billId} />
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
        <BillDetailsContent billId={billId} />
      </SheetContent>
    </Sheet>
  );
}
