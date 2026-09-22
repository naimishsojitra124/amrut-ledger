import type {
  FunctionOrderDay,
  FunctionOrderInput,
  FunctionOrderItem,
} from "@/types/function-order";

export function createFunctionOrderItem() {
  return {
    id: crypto.randomUUID(),
    itemName: "",
    quantity: 1,
    unit: "kg",
    unitPrice: 0,
    returnedQuantity: 0,
    returnNote: "",
    movements: [],
  };
}

export function createFunctionOrderDay(): FunctionOrderDay {
  return {
    deliveryDate: new Date().toISOString().slice(0, 10),
    deliveryTime: "",
    peopleCount: 0,
    notes: "",
    items: [createFunctionOrderItem()],
  };
}

export function createEmptyFunctionOrder(): FunctionOrderInput {
  return {
    customerName: "",
    mobileNumber: "",
    eventName: "",
    deliveryDays: [createFunctionOrderDay()],
    reminderDaysBefore: 1,
    status: "draft",
    notes: "",
  };
}

export function isValidFunctionOrder(value: FunctionOrderInput) {
  return Boolean(
    value.customerName.trim() &&
    value.mobileNumber.trim() &&
    value.deliveryDays.length > 0 &&
    value.deliveryDays.every(
      (day) =>
        Boolean(day.deliveryDate) &&
        day.items.length > 0 &&
        day.items.every(
          (item) =>
            Boolean(item.itemName.trim()) &&
            item.quantity > 0 &&
            item.returnedQuantity >= 0 &&
            item.returnedQuantity <= item.quantity &&
            item.unitPrice >= 0 &&
            item.movements.every((movement) => movement.quantity > 0),
        ),
    ),
  );
}

// Quantities are weights, so 9 must not print as 9.00 and 0.5 must survive.
function trimNumber(value: number): string {
  return String(Number(value.toFixed(3)));
}

export type FunctionOrderMovementLine = {
  label: string;
  quantity: number;
};

export type FunctionOrderItemSummary = {
  // Empty when there is only an initial dispatch: the total line already says it.
  breakdown: FunctionOrderMovementLine[];
  dispatched: number;
  returned: number;
  net: number;
  amount: number;
  totalLabel: string;
  quantityLabel: string;
};

// An item is charged on what stayed with the customer, so every dispatch and return is
// netted off first and the rate applied once. Billing each movement separately gives the
// same total but reads like a ledger rather than a bill.
export function summariseFunctionOrderItem(
  item: FunctionOrderItem,
): FunctionOrderItemSummary {
  const breakdown: FunctionOrderMovementLine[] = [
    { label: "Initial dispatch", quantity: item.quantity },
  ];

  let dispatched = item.quantity;
  let returned = 0;

  for (const movement of item.movements ?? []) {
    if (movement.type === "dispatch") {
      dispatched += movement.quantity;
      breakdown.push({
        label: "Additional dispatch",
        quantity: movement.quantity,
      });
    } else {
      returned += movement.quantity;
      breakdown.push({ label: "Return", quantity: movement.quantity });
    }
  }

  // The older single return field, kept so orders recorded before movements still net off.
  if (item.returnedQuantity) {
    returned += item.returnedQuantity;
    breakdown.push({ label: "Return", quantity: item.returnedQuantity });
  }

  const net = dispatched - returned;
  const unit = item.unit;

  return {
    breakdown: breakdown.length > 1 ? breakdown : [],
    dispatched,
    returned,
    net,
    amount: net * item.unitPrice,
    totalLabel: returned > 0 ? "Total after return" : "Total dispatched",
    quantityLabel:
      returned > 0
        ? `${trimNumber(dispatched)} ${unit} - ${trimNumber(returned)} ${unit} = ${trimNumber(net)} ${unit}`
        : `${trimNumber(net)} ${unit}`,
  };
}

export function formatFunctionOrderQuantity(
  quantity: number,
  unit: string,
): string {
  return `${trimNumber(quantity)} ${unit}`;
}
