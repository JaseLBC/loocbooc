/**
 * Order and OrderItem entity types.
 * Orders are created for retail purchases, Back It backings, and styling transactions.
 */

export type OrderType = "retail" | "back_it" | "styling";

export type OrderStatus =
  | "pending"
  | "payment_processing"
  | "payment_failed"
  | "confirmed"
  | "in_production"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export interface Order {
  id: string;
  userId: string;
  brandId: string;
  orderType: OrderType;
  status: OrderStatus;

  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;

  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  shopifyOrderId: string | null;

  shippingAddress: Record<string, unknown> | null;
  billingAddress: Record<string, unknown> | null;
  notes: string | null;
  metadata: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  skuId: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  campaignId: string | null; // populated if this is a Back It backing
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateOrderInput {
  userId: string;
  brandId: string;
  orderType: OrderType;
  items: CreateOrderItemInput[];
  currency?: string;
  shippingAddress?: Record<string, unknown>;
  billingAddress?: Record<string, unknown>;
  notes?: string;
}

export interface CreateOrderItemInput {
  skuId: string;
  quantity: number;
  unitPriceCents: number;
  campaignId?: string;
}
