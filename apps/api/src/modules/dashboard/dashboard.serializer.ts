/**
 * Dashboard analytics DTOs. All money values are decimal strings (exact) and all
 * dates are ISO strings, so a value is byte-identical whether it was just
 * computed or rehydrated from the Redis cache (JSON has no Date type).
 */

export interface DashboardSummaryDto {
  revenueToday: string;
  revenueThisMonth: string;
  ordersToday: number;
  ordersThisMonth: number;
  /** revenueThisMonth / paid-order-count this month. */
  averageOrderValue: string;
  customersCount: number;
  newCustomersThisMonth: number;
  /** Non-archived catalog products. */
  productsCount: number;
  lowStockCount: number;
  currency: string;
}

export interface SalesChartPoint {
  day: string;
  revenue: string;
}

export interface SalesChartDto {
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

export interface OrdersChartDto {
  points: OrdersChartPoint[];
  total: number;
  statusDistribution: OrderStatusSlice[];
}

export interface RecentOrderDto {
  id: string;
  wpOrderId: number | null;
  orderNumber: string | null;
  status: string;
  total: string;
  currency: string;
  customerName: string | null;
  orderDate: string | null;
}

export interface TopProductDto {
  productId: string | null;
  name: string;
  quantity: number;
  revenue: string;
}

export interface LowStockProductDto {
  id: string;
  name: string;
  stockQuantity: number;
  status: string;
  price: string;
}

/** Coerces a pg numeric (string|number|null) to an exact 2-decimal string. */
export function money(value: unknown): string {
  return Number(value ?? 0).toFixed(2);
}

/** Coerces a pg count/bigint (string|number|null) to a number. */
export function num(value: unknown): number {
  return Number(value ?? 0);
}

/** Coerces a pg timestamp (Date|string|null) to an ISO string or null. */
export function iso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
