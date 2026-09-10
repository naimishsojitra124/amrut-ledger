export type CardStatus = "assigned" | "available";

export interface Card {
  _id: string;
  cardAssignmentId?: string;
  cardNumber: number;
  status: CardStatus;
  createdAt: Date;
}