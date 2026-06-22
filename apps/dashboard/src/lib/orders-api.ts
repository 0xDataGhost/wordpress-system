/**
 * Orders API client for the orders screens.
 *
 * Each function calls a real backend route from the Phase 7 orders module
 * (mounted at /api/v1/orders) through the shared HTTP client, which attaches the
 * Bearer token and unwraps the response envelope:
 *   listOrders       → GET   /orders            (JWT, orders.view)
 *   getOrder         → GET   /orders/:id        (JWT, orders.view)
 *   updateOrderNotes → PATCH /orders/:id/notes  (JWT, orders.edit)
 *
 * Failures surface as `ApiError` from lib/http, whose `.message` carries the
 * backend's user-facing text — the pages render `error.message` directly.
 */

import { apiRequest } from "./http";

/** Canonical WooCommerce order statuses surfaced in the dashboard filter. */
export type OrderStatus =
  | "pending"
  | "processing"
  | "on-hold"
  | "completed"
  | "cancelled"
  | "refunded"
  | "failed";

export interface CustomerSummaryDto {
  id: string;
  wpCustomerId: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  /** Decimal string (exact money). */
  totalSpent: string;
  ordersCount: number;
  lastOrderAt: string | null;
}

export interface OrderItemDto {
  id: string;
  orderId: string;
  productId: string | null;
  wpProductId: number | null;
  name: string;
  sku: string | null;
  quantity: number;
  /** Decimal strings (exact money). */
  price: string;
  total: string;
}

export interface OrderDto {
  id: string;
  storeId: string;
  wpOrderId: number | null;
  customerId: string | null;
  orderNumber: string | null;
  /** Raw WooCommerce status; map with ORDER_STATUS_META for display. */
  status: string;
  /** Decimal string (exact money). */
  total: string;
  currency: string;
  paymentMethod: string | null;
  internalNotes: string | null;
  placedAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: CustomerSummaryDto | null;
}

export interface OrderDetailsDto extends OrderDto {
  items: OrderItemDto[];
}

export interface OrderPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface OrderListResult {
  items: OrderDto[];
  pagination: OrderPagination;
}

export interface OrderListQuery {
  search?: string;
  status?: OrderStatus;
  /** Inclusive date bounds as YYYY-MM-DD. */
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export async function listOrders(
  query: OrderListQuery = {},
): Promise<OrderListResult> {
  return apiRequest<OrderListResult>("/orders", {
    method: "GET",
    query: {
      search: query.search,
      status: query.status,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      page: query.page,
      limit: query.limit,
    },
  });
}

export async function getOrder(id: string): Promise<OrderDetailsDto> {
  return apiRequest<OrderDetailsDto>(`/orders/${id}`, { method: "GET" });
}

export async function updateOrderNotes(
  id: string,
  internalNotes: string | null,
): Promise<OrderDetailsDto> {
  return apiRequest<OrderDetailsDto>(`/orders/${id}/notes`, {
    method: "PATCH",
    body: { internalNotes },
  });
}
