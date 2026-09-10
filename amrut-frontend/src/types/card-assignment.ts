export interface CardAssignment {
  _id: string;
  cardId: string;
  customerId: string;
  assignedAt: Date;
  unassignedAt: Date | null;
  depositAtAssignment: number;
  assignedBy: string;
}