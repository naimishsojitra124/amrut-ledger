// Mirrors the backend union in src/app/realtime/realtime.types.ts.
export type RealtimeResource =
  | "customer"
  | "customer-deposit"
  | "opening-balance"
  | "daily-ledger"
  | "bill"
  | "payment"
  | "card"
  | "function-order"
  | "milk-type"
  | "product-suggestion"
  | "user"
  | "system-job";

export type RealtimeAction = "created" | "updated" | "deleted";

export type RealtimePhase = "started" | "success" | "error";

export interface RealtimeActor {
  id: string;
  role: string;
  fullName: string | null;
}

export interface RealtimeChangeEvent {
  kind: "change";
  // e.g. "customer_created_successfully"; resource/action/phase carry the same meaning
  // in parts, and the parts are what the code switches on.
  type: string;
  resource: RealtimeResource;
  action: RealtimeAction;
  phase: RealtimePhase;
  id: string;
  at: string;
  requestId: string;
  method: string;
  url: string;
  route: string;
  status: number | null;
  entityId?: string;
  customerId?: string;
  actor: RealtimeActor | null;
  // The server's own response body. Missing when this account may not read the
  // resource, or the record was too large to push, in which case refetch instead.
  data?: unknown;
  error?: { message: string } | null;
}

export type RealtimeStatus = "idle" | "connecting" | "live" | "offline";
