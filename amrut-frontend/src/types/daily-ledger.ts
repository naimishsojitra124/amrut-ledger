export interface LedgerMilkEntry {
  milkTypeId: string;
  litres: number;
}

export interface LedgerProductEntry {
  itemName: string;
  quantity: number;
  unitPrice: number;
}

export interface DailyLedgerEntry {
  _id: string;
  createdAt: Date;
  createdBy: string;
  milkEntries: LedgerMilkEntry[];
  productEntries: LedgerProductEntry[];
  notes: string;
}

export interface DailyLedger {
  _id: string;
  customerId: string;
  cardAssignmentId: string;
  ledgerDate: Date;
  entries: DailyLedgerEntry[];
  
  updatedAt: Date;
  updatedBy: string;
}