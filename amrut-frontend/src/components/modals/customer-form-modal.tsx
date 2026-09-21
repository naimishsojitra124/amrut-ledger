import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CreditCard, Loader2 } from "lucide-react";

import { useModalStore } from "@/store/modal.store";

import {
  useCustomerQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
} from "@/services/customer.service";

import {
  useAvailableCardsQuery,
  useCardNumberingQuery,
} from "@/services/card.service";

import { useActiveMilkTypesQuery } from "@/hooks/use-milk-types";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CardOption = {
  id: string;
  cardNumber: number;
};

function previousPeriodLabel(): string {
  const { month, year } = previousPeriod();
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

// An opening balance belongs to a finished month, so the first real bill carries it forward.
function previousPeriod(): { month: number; year: number } {
  const now = new Date();
  const month = now.getMonth();
  return month === 0
    ? { month: 12, year: now.getFullYear() - 1 }
    : { month, year: now.getFullYear() };
}

const customerFormSchema = z
  .object({
    fullName: z.string().trim().min(1, "Full name is required"),

    mobileNumber: z.string().trim().optional(),

    address: z.string().trim().optional(),

    depositAmount: z
      .number()
      .finite("Enter a valid deposit amount")
      .min(0, "Deposit cannot be negative"),

    openingOutstanding: z
      .number()
      .finite("Enter a valid amount")
      .min(0, "Outstanding cannot be negative")
      .optional(),

    notes: z.string().optional(),

    primaryMilkId: z.string().min(1, "Primary milk type is required"),

    milkTypeIds: z.array(z.string()).min(1, "Select at least one milk type"),

    cardId: z.string().optional().nullable(),

    cardNumber: z
      .number()
      .int("Card number must be a whole number")
      .positive("Card number must be positive")
      .optional()
      .nullable(),
  })
  .superRefine((values, ctx) => {
    if (!values.milkTypeIds.includes(values.primaryMilkId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["primaryMilkId"],
        message: "Primary milk type must be included in selected milk types",
      });
    }

    if (values.cardId == null && values.cardNumber == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cardNumber"],
        message: "Card number is required",
      });
    }
  });

type CustomerFormValues = z.infer<typeof customerFormSchema>;

export default function CustomerFormModal() {
  const { activeModal, customerForm, closeModal } = useModalStore();

  const isOpen = activeModal === "customerForm";

  const mode = customerForm?.mode ?? "create";

  const customerId = customerForm?.customerId ?? null;

  // Gated on isOpen: these modals stay mounted, and a closed one must not fetch.
  const { data: milkTypesData } = useActiveMilkTypesQuery({ enabled: isOpen });

  const customerQuery = useCustomerQuery(
    isOpen && mode === "edit" ? customerId : null,
  );

  const availableCardsQuery = useAvailableCardsQuery({ enabled: isOpen });
  const cardNumberingQuery = useCardNumberingQuery({ enabled: isOpen });
  const createCustomerMutation = useCreateCustomerMutation();
  const updateCustomerMutation = useUpdateCustomerMutation();

  const milkTypes = milkTypesData?.items ?? [];
  const customer = customerQuery.data;

  const availableCards: CardOption[] = useMemo(() => {
    return (
      availableCardsQuery.data?.items?.map((card) => ({
        id: card.id,
        cardNumber: card.cardNumber,
      })) ?? []
    );
  }, [availableCardsQuery.data]);

  const lastCardNumber = cardNumberingQuery.data?.lastCardNumber ?? null;

  const suggestedNextCardNumber = cardNumberingQuery.data?.nextCardNumber ?? 1;

  const currentCard = useMemo<CardOption | null>(() => {
    if (!customer?.currentCard?.cardId) {
      return null;
    }

    return {
      id: customer.currentCard.cardId,

      cardNumber: customer.currentCard.cardNumber ?? 0,
    };
  }, [customer?.currentCard?.cardId, customer?.currentCard?.cardNumber]);

  const cardOptions = useMemo<CardOption[]>(() => {
    if (!currentCard) {
      return availableCards;
    }

    const exists = availableCards.some((card) => card.id === currentCard.id);

    if (exists) {
      return availableCards;
    }

    return [currentCard, ...availableCards];
  }, [availableCards, currentCard]);

  const useCardSelect =
    availableCards.length > 0 || (mode === "edit" && Boolean(currentCard));

  const defaultValues = useMemo<CustomerFormValues>(() => {
    if (mode === "edit" && customer) {
      const milkTypeIds = customer.milkTypes.map(
        (milkType) => milkType.milkTypeId,
      );

      const primaryMilk = customer.milkTypes.find(
        (milkType) => milkType.isDefault,
      );

      const selectedCardId = useCardSelect
        ? (currentCard?.id ?? availableCards[0]?.id ?? "")
        : "";

      const selectedCardNumber = useCardSelect
        ? undefined
        : (currentCard?.cardNumber ?? suggestedNextCardNumber);

      return {
        fullName: customer.fullName,
        mobileNumber: customer.mobileNumber,
        address: customer.address,
        depositAmount: customer.depositAmount,
        notes: customer.notes ?? "",
        primaryMilkId: primaryMilk?.milkTypeId ?? milkTypeIds[0] ?? "",
        milkTypeIds,
        cardId: selectedCardId,
        cardNumber: selectedCardNumber,
      };
    }

    return {
      fullName: "",
      mobileNumber: "",
      address: "",
      depositAmount: 0,
      openingOutstanding: 0,
      notes: "",
      primaryMilkId: "",
      milkTypeIds: [],
      cardId: useCardSelect ? (availableCards[0]?.id ?? "") : "",
      cardNumber: useCardSelect ? undefined : suggestedNextCardNumber,
    };
  }, [
    mode,
    customer,
    useCardSelect,
    currentCard,
    availableCards,
    suggestedNextCardNumber,
  ]);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues,
  });

  const primaryMilkId = useWatch({
    control: form.control,
    name: "primaryMilkId",
  });

  const milkTypeIds = useWatch({
    control: form.control,
    name: "milkTypeIds",
  });

  const cardId = useWatch({
    control: form.control,
    name: "cardId",
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    form.reset(defaultValues);
  }, [isOpen, defaultValues, form]);

  useEffect(() => {
    if (!isOpen || !primaryMilkId) {
      return;
    }

    if (milkTypeIds.includes(primaryMilkId)) {
      return;
    }

    form.setValue("milkTypeIds", [...milkTypeIds, primaryMilkId], {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [isOpen, primaryMilkId, milkTypeIds, form]);

  const isSubmitting =
    createCustomerMutation.isPending || updateCustomerMutation.isPending;
  const isCustomerLoading = mode === "edit" && customerQuery.isLoading;
  const isAvailableCardsLoading = availableCardsQuery.isLoading;
  const isCardNumberingLoading = cardNumberingQuery.isLoading;
  const isCardDataLoading = isAvailableCardsLoading || isCardNumberingLoading;

  function resolveCardNumber(values: CustomerFormValues): number {
    if (useCardSelect) {
      if (!values.cardId) {
        throw new Error("Select a card");
      }

      const selectedCard = cardOptions.find(
        (card) => card.id === values.cardId,
      );

      if (!selectedCard) {
        throw new Error("Selected card could not be found.");
      }

      return selectedCard.cardNumber;
    }

    if (values.cardNumber == null || Number.isNaN(values.cardNumber)) {
      throw new Error("Enter a card number");
    }

    return Number(values.cardNumber);
  }

  function resolveMilkTypes(values: CustomerFormValues) {
    const otherMilkTypeIds = values.milkTypeIds.filter(
      (milkTypeId) => milkTypeId !== values.primaryMilkId,
    );

    return {
      primaryMilkTypeId: values.primaryMilkId,
      ...(otherMilkTypeIds.length > 0
        ? {
            otherMilkTypeIds,
          }
        : {}),
    };
  }

  async function onSubmit(values: CustomerFormValues) {
    try {
      const cardNumber = resolveCardNumber(values);

      const milkTypePayload = resolveMilkTypes(values);

      if (mode === "create") {
        const openingOutstanding = Math.round(values?.openingOutstanding ?? 0);

        await createCustomerMutation.mutateAsync({
          fullName: values.fullName ?? "",
          mobileNumber: values?.mobileNumber ?? "",
          address: values?.address ?? "",
          depositAmount: values?.depositAmount ?? 0,
          primaryMilkTypeId: milkTypePayload.primaryMilkTypeId ?? "",
          otherMilkTypeIds: milkTypePayload.otherMilkTypeIds ?? [],
          cardNumber,
          notes: values?.notes ?? "",
          ...(openingOutstanding > 0
            ? {
                openingBalance: {
                  amount: openingOutstanding,
                  ...previousPeriod(),
                },
              }
            : {}),
        });

        closeModal();

        return;
      }

      if (!customerId) {
        return;
      }

      await updateCustomerMutation.mutateAsync({
        id: customerId,

        payload: {
          fullName: values.fullName ?? customer?.fullName ?? "",
          mobileNumber: values?.mobileNumber ?? customer?.mobileNumber ?? "",
          address: values?.address ?? customer?.address ?? "",
          primaryMilkTypeId: milkTypePayload.primaryMilkTypeId,
          otherMilkTypeIds: milkTypePayload.otherMilkTypeIds,
          cardNumber,
          notes: values?.notes ?? "",
        },
      });

      closeModal();
    } catch (error) {
      console.error("Failed to save customer:", error);
    }
  }

  function toggleMilkType(milkTypeId: string, checked: boolean) {
    const current = form.getValues("milkTypeIds");

    const currentPrimary = form.getValues("primaryMilkId");

    if (checked) {
      const next = current.includes(milkTypeId)
        ? current
        : [...current, milkTypeId];

      form.setValue("milkTypeIds", next, {
        shouldDirty: true,
        shouldValidate: true,
      });

      if (!currentPrimary) {
        form.setValue("primaryMilkId", milkTypeId, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }

      return;
    }

    const next = current.filter((id) => id !== milkTypeId);

    if (next.length === 0) {
      form.setError("milkTypeIds", {
        type: "manual",
        message: "Select at least one milk type",
      });

      return;
    }

    form.clearErrors("milkTypeIds");

    form.setValue("milkTypeIds", next, {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (currentPrimary === milkTypeId) {
      form.setValue("primaryMilkId", next[0], {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-3xl min-w-[90vw] sm:min-w-120 md:min-w-150 lg:min-w-150 flex-col gap-0 overflow-hidden p-2 sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl">
        <DialogHeader className="shrink-0 border-b px-2 py-4 pr-12 sm:px-3 sm:py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-lg">
                {mode === "create" ? "Add Customer" : "Edit Customer"}
              </DialogTitle>

              <p className="text-sm text-neutral-500">
                {mode === "create"
                  ? "Create a new customer account."
                  : "Update customer details, milk types and card assignment."}
              </p>
            </div>
          </div>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Full Name</label>

                <Input
                  {...form.register("fullName")}
                  placeholder="Customer name"
                />

                {form.formState.errors.fullName && (
                  <p className="text-xs text-red-600">
                    {form.formState.errors.fullName.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Mobile Number</label>

                <Input
                  {...form.register("mobileNumber")}
                  placeholder="9876543210"
                  inputMode="numeric"
                />

                {form.formState.errors.mobileNumber && (
                  <p className="text-xs text-red-600">
                    {form.formState.errors.mobileNumber.message}
                  </p>
                )}
              </div>

              {mode === "create" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">
                    Available Deposit Balance
                  </label>

                  <Input
                    {...form.register("depositAmount", {
                      valueAsNumber: true,
                    })}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    inputMode="decimal"
                  />

                  {form.formState.errors.depositAmount && (
                    <p className="text-xs text-red-600">
                      {form.formState.errors.depositAmount.message}
                    </p>
                  )}
                </div>
              )}

              {mode === "create" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">
                    Previous Outstanding
                    <span className="ml-1 font-normal text-neutral-500">
                      (optional)
                    </span>
                  </label>

                  <Input
                    {...form.register("openingOutstanding", {
                      valueAsNumber: true,
                    })}
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    inputMode="numeric"
                  />

                  <p className="text-xs text-neutral-500">
                    Amount this customer already owes from your paper records.
                    It is recorded against {previousPeriodLabel()} and will be
                    carried into their first bill.
                  </p>

                  {form.formState.errors.openingOutstanding && (
                    <p className="text-xs text-red-600">
                      {form.formState.errors.openingOutstanding.message}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Primary Milk Type</label>

                <Select
                  value={primaryMilkId}
                  onValueChange={(value) => {
                    form.setValue("primaryMilkId", value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });

                    const current = form.getValues("milkTypeIds");

                    if (!current.includes(value)) {
                      form.setValue("milkTypeIds", [...current, value], {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select primary milk type" />
                  </SelectTrigger>

                  <SelectContent position="popper">
                    {milkTypes.map((milk) => (
                      <SelectItem key={milk._id} value={milk._id}>
                        {milk.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {form.formState.errors.primaryMilkId && (
                  <p className="text-xs text-red-600">
                    {form.formState.errors.primaryMilkId.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Notes</label>

              <Textarea
                {...form.register("notes")}
                placeholder="Optional notes"
                className="min-h-16"
              />
            </div>

            <div className="space-y-3 rounded-xl border p-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#266699]" />

                <span className="text-sm font-semibold text-neutral-900">
                  Card Assignment
                </span>
              </div>

              {isAvailableCardsLoading ? (
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading available cards...
                </div>
              ) : useCardSelect ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Select Card</label>

                  <Select
                    value={cardId ?? ""}
                    onValueChange={(value) => {
                      form.setValue("cardId", value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select available card" />
                    </SelectTrigger>

                    <SelectContent position="popper">
                      {cardOptions.map((card) => {
                        const isCurrent =
                          mode === "edit" &&
                          card.id === customer?.currentCard?.cardId;

                        return (
                          <SelectItem key={card.id} value={card.id}>
                            Card #{card.cardNumber}
                            {isCurrent ? " (Current)" : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>

                  <p className="text-xs text-neutral-500">
                    {mode === "edit" && customer?.currentCard?.cardNumber ? (
                      <>Current card: #{customer.currentCard.cardNumber}</>
                    ) : (
                      "Choose an available card. The selected card will be assigned to this customer."
                    )}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium">Card Number</label>

                    {isCardNumberingLoading && (
                      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Checking card numbers...
                      </div>
                    )}
                  </div>

                  <Input
                    {...form.register("cardNumber", {
                      setValueAs: (value) =>
                        value === "" || value === null
                          ? undefined
                          : Number(value),
                    })}
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    placeholder={String(suggestedNextCardNumber)}
                  />

                  <div className="space-y-1 text-xs text-neutral-500">
                    <p>
                      Last card number:{" "}
                      <span className="font-medium text-neutral-700">
                        {lastCardNumber !== null
                          ? `#${lastCardNumber}`
                          : "No cards yet"}
                      </span>
                    </p>

                    <p>
                      Suggested next number:{" "}
                      <span className="font-medium text-neutral-700">
                        #{suggestedNextCardNumber}
                      </span>
                    </p>

                    {mode === "edit" &&
                      customer?.currentCard?.cardNumber != null && (
                        <p>
                          Current card:{" "}
                          <span className="font-medium text-neutral-700">
                            #{customer.currentCard.cardNumber}
                          </span>
                        </p>
                      )}
                  </div>

                  {form.formState.errors.cardNumber && (
                    <p className="text-xs text-red-600">
                      {form.formState.errors.cardNumber.message}
                    </p>
                  )}

                  {cardNumberingQuery.isError && (
                    <p className="text-xs text-red-600">
                      Unable to determine the next card number. Please enter a
                      card number manually.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Milk Types</label>

                <p className="text-xs text-neutral-500">
                  Select one or more milk types for this customer.
                </p>
              </div>

              <div className="grid gap-3 grid-cols-2">
                {milkTypes.map((milk) => {
                  const checked = milkTypeIds.includes(milk._id);

                  return (
                    <label
                      key={milk._id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          toggleMilkType(milk._id, Boolean(value))
                        }
                      />

                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{milk.name}</span>

                        <span className="text-xs text-neutral-500">
                          ₹{Number(milk.rate).toFixed(2)} / Ltr
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>

              {form.formState.errors.milkTypeIds && (
                <p className="text-xs text-red-600">
                  {form.formState.errors.milkTypeIds.message}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-6 sm:py-4">
            <Button
              type="button"
              variant="outline"
              onClick={closeModal}
              disabled={isSubmitting}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting || isCustomerLoading || isCardDataLoading}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : mode === "create" ? (
                "Create Customer"
              ) : (
                "Update Customer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
