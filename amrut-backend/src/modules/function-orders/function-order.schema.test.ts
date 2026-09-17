import { describe, expect, it } from "vitest";
import { createFunctionOrderSchema } from "./function-order.schema";

const validOrder = {
  customerName: "Test Customer",
  mobileNumber: "9876543210",
  eventName: "Reception",
  reminderDaysBefore: 2,
  status: "confirmed" as const,
  notes: "",
  deliveryDays: [
    {
      deliveryDate: "2026-09-15",
      notes: "",
      items: [
        {
          itemName: "Rabadi",
          quantity: 30,
          unit: "kg",
          unitPrice: 420,
          returnedQuantity: 5,
          returnNote: "Unused",
        },
      ],
    },
  ],
};

describe("function order validation", () => {
  it("accepts multi-day orders with valid returns", () =>
    expect(
      createFunctionOrderSchema.parse(validOrder).deliveryDays[0]!.items[0]!.returnedQuantity,
    ).toBe(5));
  it("rejects returns greater than supplied quantity", () =>
    expect(() =>
      createFunctionOrderSchema.parse({
        ...validOrder,
        deliveryDays: [
          {
            ...validOrder.deliveryDays[0]!,
            items: [{ ...validOrder.deliveryDays[0]!.items[0]!, returnedQuantity: 31 }],
          },
        ],
      }),
    ).toThrow("Returned quantity cannot exceed quantity"));
});
