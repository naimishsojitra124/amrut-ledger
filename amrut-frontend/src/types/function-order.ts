export interface PageInfo {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export const FUNCTION_ORDER_STATUSES = [
  "draft",
  "confirmed",
  "completed",
  "cancelled",
] as const;

export type FunctionOrderStatus =
  (typeof FUNCTION_ORDER_STATUSES)[number];

export type FunctionOrderItemMovement = {
  id: string;
  type: "dispatch" | "return";
  quantity: number;
  note: string;
  createdAt: string;
};

export type FunctionOrderItem = {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;

  returnedQuantity: number;
  returnNote: string;

  movements: FunctionOrderItemMovement[];
};

export type FunctionOrderDay = {
  deliveryDate: string;
  deliveryTime: string;
  peopleCount: number;
  items: FunctionOrderItem[];
  notes: string;
};

export type FunctionOrderAuditLog = {
  id: string;
  action: string;
  details: string;
  performedAt: string;
};

export type FunctionOrderListItemsResponse = {
  id: string;
  orderNumber: string;
  customerName: string;
  mobileNumber: string;
  eventName: string;
  deliveryDays: FunctionOrderDay[];
  reminderDaysBefore: number;
  status: FunctionOrderStatus;
  notes: string;
  createdById: string;
  updatedById: string;
  createdAt: string;
  updatedAt: string;
};

export type FunctionOrder = FunctionOrderListItemsResponse;

export interface FunctionOrderListResponse {
  items: FunctionOrderListItemsResponse[];
  pageInfo: PageInfo;
}

export interface FunctionOrderListQuery {
  page?: number;
  limit?: number;
  status?: FunctionOrderStatus;
  search?: string;
}

export type FunctionOrderInput = Omit<
  FunctionOrderListItemsResponse,
  | "id"
  | "orderNumber"
  | "createdById"
  | "updatedById"
  | "createdAt"
  | "updatedAt"
>;

/** A single item to prepare, already summed across every order for that day. */
export interface FunctionOrderPrepItem {
  itemName: string;
  unit: string;
  quantity: number;
}

export interface FunctionOrderPrepDay {
  deliveryDate: string;
  daysUntil: number;
  items: FunctionOrderPrepItem[];
}

export interface FunctionOrderReminderDay {
  orderId: string;
  orderNumber: string;
  customerName: string;
  mobileNumber: string | null;
  eventName: string;
  deliveryDate: string;
  deliveryTime: string;
  peopleCount: number;
  daysUntil: number;
  dueForReminder: boolean;
  items: FunctionOrderPrepItem[];
}

export interface FunctionOrderReminderResponse {
  generatedAt: string;
  daysAhead: number;
  days: FunctionOrderReminderDay[];
  preparation: FunctionOrderPrepDay[];
}

