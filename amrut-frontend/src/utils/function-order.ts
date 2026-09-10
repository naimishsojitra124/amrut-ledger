import type {
  FunctionOrderDay,
  FunctionOrderInput,
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

export function isValidFunctionOrder(
  value: FunctionOrderInput,
) {
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
              item.movements.every(
                (movement) =>
                  movement.quantity > 0,
              ),
          ),
      ),
  );
}