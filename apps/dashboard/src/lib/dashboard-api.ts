/**
 * Dashboard analytics API client.
 *
 * Calls the Phase 9 dashboard module (mounted at /api/v1/dashboard) through the
 * shared HTTP client. Every endpoint requires `dashboard.view` and is scoped to
 * the caller's store on the backend. Money values are decimal strings; dates are
 * ISO strings; chart day keys are YYYY-MM-DD (UTC).
 */

import { apiRequest } from "./http";

export type DashboardPeriod = "today" | "7d" | "30d" | "this_month" | "custom";

export interface RangeParams {
  period: DashboardPeriod;
  /** YYYY-MM-DD, required when period === "custom". */
  dateFrom?: string;
  dateTo?: string;
  refresh?: boolean;
}

export interface DashboardSummary {
  revenueToday: string;
  revenueThisMonth: string;
  ordersToday: number;
  ordersThisMonth: number;
  averageOrderValue: string;
  customersCount: number;
  newCustomersThisMonth: number;
  productsCount: number;
  lowStockCount: number;
  currency: string;
}

export interface SalesChartPoint {
  day: string;
  revenue: string;
}
export interface SalesChart {
  points: SalesChartPoint[];
  total: string;
  currency: string;
}

export interface OrdersChartPoint {
  day: string;
  orders: number;
}
export interface OrderStatusSlice {
  status: string;
  count: number;
}
export interface OrdersChart {
  points: OrdersChartPoint[];
  total: number;
  statusDistribution: OrderStatusSlice[];
}

export interface RecentOrder {
  id: string;
  wpOrderId: number | null;
  orderNumber: string | null;
  status: string;
  total: string;
  currency: string;
  customerName: string | null;
  orderDate: string | null;
}

export interface TopProduct {
  productId: string | null;
  name: string;
  quantity: number;
  revenue: string;
}

export interface LowStockProduct {
  id: string;
  name: string;
  stockQuantity: number;
  status: string;
  price: string;
}

type Query = Record<string, string | number | undefined>;

function rangeQuery(range: RangeParams): Query {
  return {
    period: range.period,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    refresh: range.refresh ? "true" : undefined,
  };
}

export function getSummary(refresh = false): Promise<DashboardSummary> {
  return apiRequest<DashboardSummary>("/dashboard/summary", {
    method: "GET",
    query: { refresh: refresh ? "true" : undefined },
  });
}

export function getSalesChart(range: RangeParams): Promise<SalesChart> {
  return apiRequest<SalesChart>("/dashboard/sales-chart", {
    method: "GET",
    query: rangeQuery(range),
  });
}

export function getOrdersChart(range: RangeParams): Promise<OrdersChart> {
  return apiRequest<OrdersChart>("/dashboard/orders-chart", {
    method: "GET",
    query: rangeQuery(range),
  });
}

export function getRecentOrders(
  limit = 5,
  refresh = false,
): Promise<RecentOrder[]> {
  return apiRequest<RecentOrder[]>("/dashboard/recent-orders", {
    method: "GET",
    query: { limit, refresh: refresh ? "true" : undefined },
  });
}

export function getTopProducts(
  range: RangeParams,
  limit = 5,
): Promise<TopProduct[]> {
  return apiRequest<TopProduct[]>("/dashboard/top-products", {
    method: "GET",
    query: { ...rangeQuery(range), limit },
  });
}

export function getLowStock(limit = 5, refresh = false): Promise<LowStockProduct[]> {
  return apiRequest<LowStockProduct[]>("/dashboard/low-stock", {
    method: "GET",
    query: { limit, refresh: refresh ? "true" : undefined },
  });
}
