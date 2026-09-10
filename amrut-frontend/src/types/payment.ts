export type PaymentMethod = "cash" | "upi";

export interface Payment {
  _id: string;
  customerId: string;

  billId: string;
  billMonth: number;
  billYear: number;

  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber: string;
  notes: string;

  receivedAt: Date;
  receivedBy: string;

  editedAt?: Date;
  editedBy?: string;
}