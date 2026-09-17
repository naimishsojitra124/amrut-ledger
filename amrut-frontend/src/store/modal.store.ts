import { create } from "zustand";

export type CustomerFormMode = "create" | "edit";

export type AppModal =
  | "customerForm"
  | "payment"
  | "generateBill"
  | "outstandingLedger"
  | "milkTypeForm"
  | "productSuggestionForm"
  | "userForm"
  | "editLedger"
  | "deleteLedger"
  | "fullLedger"
  | "customerCloseConfirm"
  | "functionOrderDeleteConfirm"
  | "confirmation";

type CustomerFormPayload = {
  mode: CustomerFormMode;
  customerId: string | null;
};

type PaymentPayload = {
  billId: string;
  customerId: string;
};

type SettingsFormPayload = {
  id: string | null;
};

type CustomerModalPayload = {
  customerId: string;
  customerName?: string;
};

type FullLedgerPayload = {
  customerId: string;
  selectedDate: string;
  outstandingAmount?: number | null;
};

type CustomerCloseConfirmPayload = {
  customerId: string;
  customerName: string;
  depositAmount: number;
  onConfirmed?: () => void;
};

type FunctionOrderDeleteConfirmPayload = {
  orderId: string;
  orderNumber: string;
  onConfirmed?: () => void;
};

export type ConfirmationPayload = {
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  successMessage?: string;
  onConfirm: () => void | Promise<void>;
};

type ModalStore = {
  activeModal: AppModal | null;

  customerForm: CustomerFormPayload | null;
  payment: PaymentPayload | null;
  settingsForm: SettingsFormPayload | null;
  customerModal: CustomerModalPayload | null;
  fullLedger: FullLedgerPayload | null;

  customerCloseConfirm:
    | CustomerCloseConfirmPayload
    | null;

  functionOrderDeleteConfirm:
    | FunctionOrderDeleteConfirmPayload
    | null;

  confirmation: ConfirmationPayload | null;

  openCustomerCreate: () => void;
  openCustomerEdit: (
    customerId: string,
  ) => void;

  openPayment: (
    payload: PaymentPayload,
  ) => void;

  openMilkTypeForm: (
    id?: string,
  ) => void;

  openProductSuggestionForm: (
    id?: string,
  ) => void;

  openUserForm: (
    id?: string,
  ) => void;

  openGenerateBill: (
    payload: CustomerModalPayload,
  ) => void;

  openOutstandingLedger: (
    payload: CustomerModalPayload,
  ) => void;

  openFullLedger: (
    payload: FullLedgerPayload,
  ) => void;

  openCustomerCloseConfirm: (
    payload: CustomerCloseConfirmPayload,
  ) => void;

  openFunctionOrderDeleteConfirm: (
    payload: FunctionOrderDeleteConfirmPayload,
  ) => void;

  openConfirmation: (payload: ConfirmationPayload) => void;

  openModal: (
    modal: Exclude<
      AppModal,
      | "customerForm"
      | "payment"
      | "fullLedger"
      | "customerCloseConfirm"
      | "functionOrderDeleteConfirm"
    >,
  ) => void;

  closeModal: () => void;
};

export const useModalStore =
  create<ModalStore>((set) => ({
    activeModal: null,

    customerForm: null,
    payment: null,
    settingsForm: null,
    customerModal: null,
    fullLedger: null,

    customerCloseConfirm: null,
    functionOrderDeleteConfirm: null,
    confirmation: null,

    openCustomerCreate: () =>
      set({
        activeModal: "customerForm",

        customerForm: {
          mode: "create",
          customerId: null,
        },

        payment: null,
        settingsForm: null,
        customerModal: null,
        fullLedger: null,
        customerCloseConfirm: null,
        functionOrderDeleteConfirm: null,
      }),

    openCustomerEdit: (
      customerId,
    ) =>
      set({
        activeModal: "customerForm",

        customerForm: {
          mode: "edit",
          customerId,
        },

        payment: null,
        settingsForm: null,
        customerModal: null,
        fullLedger: null,
        customerCloseConfirm: null,
        functionOrderDeleteConfirm: null,
      }),

    openPayment: (
      payload,
    ) =>
      set({
        activeModal: "payment",

        customerForm: null,
        payment: payload,
        settingsForm: null,
        customerModal: null,
        fullLedger: null,
        customerCloseConfirm: null,
        functionOrderDeleteConfirm: null,
      }),

    openMilkTypeForm: (
      id,
    ) =>
      set({
        activeModal: "milkTypeForm",

        customerForm: null,
        payment: null,

        settingsForm: {
          id: id ?? null,
        },

        customerModal: null,
        fullLedger: null,
        customerCloseConfirm: null,
        functionOrderDeleteConfirm: null,
      }),

    openProductSuggestionForm: (
      id,
    ) =>
      set({
        activeModal:
          "productSuggestionForm",

        customerForm: null,
        payment: null,

        settingsForm: {
          id: id ?? null,
        },

        customerModal: null,
        fullLedger: null,
        customerCloseConfirm: null,
        functionOrderDeleteConfirm: null,
      }),

    openUserForm: (
      id,
    ) =>
      set({
        activeModal: "userForm",

        customerForm: null,
        payment: null,

        settingsForm: {
          id: id ?? null,
        },

        customerModal: null,
        fullLedger: null,
        customerCloseConfirm: null,
        functionOrderDeleteConfirm: null,
      }),

    openGenerateBill: (
      payload,
    ) =>
      set({
        activeModal: "generateBill",

        customerForm: null,
        payment: null,
        settingsForm: null,

        customerModal: payload,

        fullLedger: null,
        customerCloseConfirm: null,
        functionOrderDeleteConfirm: null,
      }),

    openOutstandingLedger: (
      payload,
    ) =>
      set({
        activeModal:
          "outstandingLedger",

        customerForm: null,
        payment: null,
        settingsForm: null,

        customerModal: payload,

        fullLedger: null,
        customerCloseConfirm: null,
        functionOrderDeleteConfirm: null,
      }),

    openFullLedger: (
      payload,
    ) =>
      set({
        activeModal: "fullLedger",

        customerForm: null,
        payment: null,
        settingsForm: null,
        customerModal: null,

        fullLedger: payload,

        customerCloseConfirm: null,
        functionOrderDeleteConfirm: null,
      }),

    openCustomerCloseConfirm: (
      payload,
    ) =>
      set({
        activeModal:
          "customerCloseConfirm",

        customerForm: null,
        payment: null,
        settingsForm: null,
        customerModal: null,
        fullLedger: null,

        customerCloseConfirm:
          payload,

        functionOrderDeleteConfirm:
          null,
      }),

    openFunctionOrderDeleteConfirm: (
      payload,
    ) =>
      set({
        activeModal:
          "functionOrderDeleteConfirm",

        customerForm: null,
        payment: null,
        settingsForm: null,
        customerModal: null,
        fullLedger: null,
        customerCloseConfirm: null,

        functionOrderDeleteConfirm:
          payload,
      }),

    openConfirmation: (payload) =>
      set({
        activeModal: "confirmation",
        confirmation: payload,
      }),

    openModal: (
      modal,
    ) =>
      set({
        activeModal: modal,

        customerForm: null,
        payment: null,
        settingsForm: null,
        customerModal: null,
        fullLedger: null,
        customerCloseConfirm: null,
        functionOrderDeleteConfirm: null,
        confirmation: null,
      }),

    closeModal: () =>
      set({
        activeModal: null,

        customerForm: null,
        payment: null,
        settingsForm: null,
        customerModal: null,
        fullLedger: null,

        customerCloseConfirm: null,
        functionOrderDeleteConfirm: null,
        confirmation: null,
      }),
  }));