import CustomerFormModal from "@/components/modals/customer-form-modal";
import { PaymentModal } from "./payment-modal";
import { GenerateBillModal } from "./generate-bill-modal";
import { OutstandingLedgerModal } from "./outstanding-ledger-modal";
import { MilkTypeFormModal } from "./milk-type-form-modal";
import { ProductSuggestionFormModal } from "./product-suggestion-form-modal";
import CloseCustomerConfirmModal from "./close-customer-confirmation-modal";
import DeleteFunctionOrderConfirmationModal from "./delete-function-order-confirmation-modal";

export function AppModals() {
  return (
    <>
      <CustomerFormModal />
      <CloseCustomerConfirmModal />
      <PaymentModal />
      <GenerateBillModal />
      <OutstandingLedgerModal />
      <MilkTypeFormModal />
      <ProductSuggestionFormModal />
      <DeleteFunctionOrderConfirmationModal />
    </>
  );
}
