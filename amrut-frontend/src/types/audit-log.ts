export type AuditLogType =
  | "customer_created"
  | "customer_updated"
  | "customer_closed"
  | "customer_reopened"
  | "card_assigned"
  | "card_unassigned"
  | "milk_type_changed"
  | "deposit_updated"
  | "entry_added"
  | "entry_updated"
  | "entry_deleted"
  | "bill_generated"
  | "payment_added"
  | "payment_reversed"
  | "note_added";

interface AuditFieldChange {
  field: string;
  oldValue: string;
  newValue: string;
}

export interface AuditLog {
  _id: string;
  customerId: string;
  type: AuditLogType;
  title: string;
  details: AuditFieldChange[];
  performedBy: string;
  performedAt: Date;
  relatedEntityType?: "ledger" | "bill" | "payment" | "card" | "card-assignment"; 
  relatedEntityId?: string;
}
