import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CustomerDailyHistoryTab from "@/components/customers/tabs/customer-daily-history-tab";
import { useModalStore } from "@/store/modal.store";

export default function FullLedgerModal() {
  const activeModal = useModalStore((state) => state.activeModal);
  const fullLedger = useModalStore((state) => state.fullLedger);
  const closeModal = useModalStore((state) => state.closeModal);

  const open = activeModal === "fullLedger" && Boolean(fullLedger);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeModal();
        }
      }}
    >
      <DialogContent
        className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-6xl min-w-[90vw] sm:min-w-150 md:min-w-175 lg:min-w-200 flex-col gap-0 overflow-hidden p-2 sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl"
        aria-describedby={undefined}
      >
        <DialogHeader className="shrink-0 border-b px-2 py-4 pr-12 sm:px-3 sm:py-3">
          <DialogTitle className="text-base font-semibold text-[#266699] sm:text-lg">
            Full Customer Ledger
          </DialogTitle>

          <DialogDescription className="text-xs sm:text-sm">
            Review the complete monthly purchase history and totals before
            preparing the customer&apos;s bill.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-5">
          {open && fullLedger ? (
            <CustomerDailyHistoryTab
              key={`${fullLedger.customerId}-${fullLedger.selectedDate}`}
              customerId={fullLedger.customerId}
              initialDate={fullLedger.selectedDate}
              outstandingAmount={fullLedger.outstandingAmount}
              showGenerateBill
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
