/**
 * App-wide business constants. Centralized so a rule (e.g. the low-stock
 * threshold) is changed in one place, not hunted down across components.
 * Where a spec value is also admin-configurable at runtime (e.g. shipping
 * cost), this is the *fallback default* used until admin_settings overrides it.
 */

export const ROLES = {
  ADMIN: "admin",
  CUSTOMER: "customer",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Stock status thresholds. Overridable via admin_settings.low_stock_threshold. */
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export const STOCK_STATUS = {
  IN_STOCK: "in_stock",
  LOW_STOCK: "low_stock",
  OUT_OF_STOCK: "out_of_stock",
} as const;
export type StockStatus = (typeof STOCK_STATUS)[keyof typeof STOCK_STATUS];

/**
 * quantity > threshold        -> in_stock
 * 1 <= quantity <= threshold  -> low_stock
 * quantity = 0                -> out_of_stock
 */
export function getStockStatus(
  quantity: number,
  threshold: number = DEFAULT_LOW_STOCK_THRESHOLD,
): StockStatus {
  if (quantity <= 0) return STOCK_STATUS.OUT_OF_STOCK;
  if (quantity <= threshold) return STOCK_STATUS.LOW_STOCK;
  return STOCK_STATUS.IN_STOCK;
}

export const ORDER_STATUS = {
  UNCONFIRMED: "unconfirmed",
  PAYMENT_PENDING: "payment_pending",
  CONFIRMED: "confirmed",
  IN_PROCESS: "in_process",
  DELIVERED: "delivered",
  PARTIAL_COMPLETED: "partial_completed",
  COMPLETED: "completed",
  RETURN_INITIATED: "return_initiated",
  RETURN_PROCESSING: "return_processing",
  RETURNED: "returned",
  CANCELLED: "cancelled",
} as const;
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

/**
 * Valid server-side order status transitions. Anything not listed here is
 * rejected by lib/orders/transitions.ts regardless of who requests it.
 * `cancelled` is reachable from any pre-delivery state (a customer or admin
 * may cancel before the order ships). `return_initiated`'s targets are
 * either the approval step (return_processing) or a revert back to
 * whichever of delivered/partial_completed/completed the order was in
 * before the return was requested — see orders.pre_return_status.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  unconfirmed: [ORDER_STATUS.PAYMENT_PENDING, ORDER_STATUS.CANCELLED],
  payment_pending: [
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.UNCONFIRMED,
    ORDER_STATUS.CANCELLED,
  ],
  confirmed: [ORDER_STATUS.IN_PROCESS, ORDER_STATUS.CANCELLED],
  in_process: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
  delivered: [ORDER_STATUS.COMPLETED, ORDER_STATUS.PARTIAL_COMPLETED, ORDER_STATUS.RETURN_INITIATED],
  partial_completed: [ORDER_STATUS.COMPLETED, ORDER_STATUS.RETURN_INITIATED],
  completed: [ORDER_STATUS.RETURN_INITIATED],
  return_initiated: [
    ORDER_STATUS.RETURN_PROCESSING,
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.PARTIAL_COMPLETED,
    ORDER_STATUS.COMPLETED,
  ],
  return_processing: [ORDER_STATUS.RETURNED],
  returned: [],
  cancelled: [],
};

/** Human-readable labels for order-status emails/notifications and admin UI. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  unconfirmed: "Unconfirmed",
  payment_pending: "Payment Pending",
  confirmed: "Confirmed",
  in_process: "Processing",
  delivered: "Delivered",
  partial_completed: "Partially Completed",
  completed: "Completed",
  return_initiated: "Return Initiated",
  return_processing: "Return Processing",
  returned: "Returned",
  cancelled: "Cancelled",
};

/**
 * Plain-language descriptions shown as a hover tooltip on every order
 * status badge, both admin- and customer-facing (OrderStatusBadge is the
 * one shared component both sides render) — so "what does 'Processing'
 * actually mean" never has to be guessed from the label alone.
 */
export const ORDER_STATUS_DESCRIPTIONS: Record<OrderStatus, string> = {
  unconfirmed: "The order has been placed, but payment hasn't been submitted or confirmed yet.",
  payment_pending: "The customer submitted a payment proof and it's awaiting admin review.",
  confirmed: "Payment has been approved. The order is confirmed and will be prepared next.",
  in_process: "The order is being prepared/packed for shipment.",
  delivered: "The order has been delivered to the customer.",
  partial_completed: "The customer has reviewed some, but not all, of the products in this order.",
  completed: "The order is fully complete — the customer has reviewed every product in it.",
  return_initiated: "The customer requested a return with proof and a reason; it's awaiting admin review.",
  return_processing: "The return was approved. The customer is shipping the item(s) back.",
  returned: "The returned item(s) have been received back and the return is complete.",
  cancelled: "The order was cancelled before it shipped.",
};

export const PAYMENT_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

/** "full" = whole order total up front; "delivery_fee" = only the delivery fee now, the rest cash on delivery. */
export const PAYMENT_TYPES = ["full", "delivery_fee"] as const;

export const PAYMENT_TYPE_LABELS: Record<(typeof PAYMENT_TYPES)[number], string> = {
  full: "Full payment",
  delivery_fee: "Delivery fee (rest on delivery)",
};

export const PAYMENT_REJECTION_REASONS = [
  "Wrong amount",
  "Invalid transaction",
  "Unreadable screenshot",
  "Payment not received",
  "Wrong account",
  "Duplicate payment",
  "Other",
] as const;

export const NOTIFICATION_TYPE = {
  ORDER: "order",
  PAYMENT: "payment",
  ANNOUNCEMENT: "announcement",
  PROMOTION: "promotion",
  SYSTEM: "system",
} as const;
export type NotificationType =
  (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

/** Fallback shipping cost (in the store's base currency unit), overridable via admin_settings. */
export const DEFAULT_SHIPPING_COST = 250;

export const CURRENCY = {
  code: "PKR",
  locale: "en-PK",
} as const;

export const STORAGE_BUCKETS = {
  PRODUCT_IMAGES: "product-images",
  PAYMENT_PROOFS: "payment-proofs",
  RETURN_PROOFS: "return-proofs",
  AVATARS: "avatars",
  BANNERS: "banners",
} as const;

/** Return requests need at least one photo, and no more than this many. */
export const MAX_RETURN_PROOF_IMAGES = 5;

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
