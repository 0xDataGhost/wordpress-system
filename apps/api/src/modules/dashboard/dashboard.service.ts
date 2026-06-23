import { and, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "../../db";
import { env } from "../../config/env";
import { customers } from "../../db/schema/customers";
import { orderItems } from "../../db/schema/order-items";
import { orders } from "../../db/schema/orders";
import { products } from "../../db/schema/products";
import {
  addUtcDays,
  dayKey,
  rangeDayBuckets,
  startOfNextUtcMonth,
  startOfUtcDay,
  startOfUtcMonth,
  type ResolvedRange,
} from "./dashboard.range";
import {
  iso,
  money,
  num,
  type DashboardSummaryDto,
  type LowStockProductDto,
  type OrdersChartDto,
  type RecentOrderDto,
  type SalesChartDto,
  type TopProductDto,
} from "./dashboard.serializer";

/**
 * Order statuses that count as realised revenue, per the Phase 9 spec:
 * include processing / completed / on-hold; exclude cancelled / refunded /
 * failed (and pending, which is unpaid). Used for all revenue + AOV figures and
 * for top-products revenue. (Order *counts* and the status distribution span
 * every status.)
 */
export const REVENUE_STATUSES = ["completed", "processing", "on-hold"] as const;
const PAID = [...REVENUE_STATUSES];

/** Effective order date: WooCommerce placed-at when known, else our created-at. */
const orderDate = sql`coalesce(${orders.placedAt}, ${orders.createdAt})`;

/** UTC day key (YYYY-MM-DD) for the effective order date — stable across TZ. */
const orderDayKey = sql<string>`to_char(${orderDate} at time zone 'UTC', 'YYYY-MM-DD')`;

/** SQL predicate: order's effective date falls within [start, end). */
function inRange(range: ResolvedRange) {
  return and(gte(orderDate, range.start), lt(orderDate, range.end));
}

/**
 * Fixed-period KPI summary (today / this month / current totals). Not affected
 * by the dashboard date filter. Tenant-scoped by storeId throughout.
 */
export async function getSummary(
  storeId: string,
  now: Date,
): Promise<DashboardSummaryDto> {
  const todayStart = startOfUtcDay(now);
  const tomorrowStart = addUtcDays(todayStart, 1);
  const monthStart = startOfUtcMonth(now);
  const nextMonthStart = startOfNextUtcMonth(now);
  const threshold = env.DASHBOARD_LOW_STOCK_THRESHOLD;

  const revenueExpr = sql<string>`coalesce(sum(${orders.total}) filter (where ${inArray(
    orders.status,
    PAID,
  )}), 0)`;
  const paidCountExpr = sql<number>`count(*) filter (where ${inArray(
    orders.status,
    PAID,
  )})`;

  const [todayAgg, monthAgg, customerAgg, productAgg, currencyRow] =
    await Promise.all([
      // Today: total order count + paid revenue.
      db
        .select({ orders: count(), revenue: revenueExpr })
        .from(orders)
        .where(
          and(
            eq(orders.storeId, storeId),
            gte(orderDate, todayStart),
            lt(orderDate, tomorrowStart),
          ),
        ),
      // This month: order count, paid revenue, paid order count (for AOV).
      db
        .select({
          orders: count(),
          revenue: revenueExpr,
          paidOrders: paidCountExpr,
        })
        .from(orders)
        .where(
          and(
            eq(orders.storeId, storeId),
            gte(orderDate, monthStart),
            lt(orderDate, nextMonthStart),
          ),
        ),
      // Customers: total + new this month.
      db
        .select({
          total: count(),
          newThisMonth: sql<number>`count(*) filter (where ${customers.createdAt} >= ${monthStart} and ${customers.createdAt} < ${nextMonthStart})`,
        })
        .from(customers)
        .where(eq(customers.storeId, storeId)),
      // Products: non-archived catalog size + low-stock count.
      db
        .select({
          total: sql<number>`count(*) filter (where ${products.status} <> 'archived')`,
          lowStock: sql<number>`count(*) filter (where ${products.status} = 'active' and ${products.stockQuantity} <= ${threshold})`,
        })
        .from(products)
        .where(eq(products.storeId, storeId)),
      // Display currency: most recent order's currency, else default SAR.
      db
        .select({ currency: orders.currency })
        .from(orders)
        .where(eq(orders.storeId, storeId))
        .orderBy(sql`${orderDate} desc`, desc(orders.id))
        .limit(1),
    ]);

  const revenueThisMonth = money(monthAgg[0]?.revenue);
  const paidOrdersThisMonth = num(monthAgg[0]?.paidOrders);
  const aov =
    paidOrdersThisMonth > 0
      ? (Number(revenueThisMonth) / paidOrdersThisMonth).toFixed(2)
      : "0.00";

  return {
    revenueToday: money(todayAgg[0]?.revenue),
    revenueThisMonth,
    ordersToday: num(todayAgg[0]?.orders),
    ordersThisMonth: num(monthAgg[0]?.orders),
    averageOrderValue: aov,
    customersCount: num(customerAgg[0]?.total),
    newCustomersThisMonth: num(customerAgg[0]?.newThisMonth),
    productsCount: num(productAgg[0]?.total),
    lowStockCount: num(productAgg[0]?.lowStock),
    currency: currencyRow[0]?.currency ?? "SAR",
  };
}

interface DailyRow {
  day: string;
  revenue: string;
  orders: number;
}

/**
 * Per-UTC-day revenue (paid only) and order counts (all statuses) within the
 * range, zero-filled across every day bucket so charts have a continuous axis.
 */
async function getDailySeries(
  storeId: string,
  range: ResolvedRange,
): Promise<DailyRow[]> {
  const rows = await db
    .select({
      day: orderDayKey,
      revenue: sql<string>`coalesce(sum(${orders.total}) filter (where ${inArray(
        orders.status,
        PAID,
      )}), 0)`,
      orders: count(),
    })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), inRange(range)))
    .groupBy(orderDayKey);

  const byDay = new Map(rows.map((r) => [r.day, r]));
  return rangeDayBuckets(range).map((d) => {
    const key = dayKey(d);
    const hit = byDay.get(key);
    return {
      day: key,
      revenue: money(hit?.revenue),
      orders: num(hit?.orders),
    };
  });
}

/** Revenue-over-time chart (paid revenue per UTC day). */
export async function getSalesChart(
  storeId: string,
  range: ResolvedRange,
): Promise<SalesChartDto> {
  const series = await getDailySeries(storeId, range);
  const points = series.map((r) => ({ day: r.day, revenue: r.revenue }));
  const total = points
    .reduce((sum, p) => sum + Number(p.revenue), 0)
    .toFixed(2);

  const [currencyRow] = await db
    .select({ currency: orders.currency })
    .from(orders)
    .where(eq(orders.storeId, storeId))
    .orderBy(sql`${orderDate} desc`, desc(orders.id))
    .limit(1);

  return { points, total, currency: currencyRow?.currency ?? "SAR" };
}

/** Orders-over-time chart (order count per UTC day) + status distribution. */
export async function getOrdersChart(
  storeId: string,
  range: ResolvedRange,
): Promise<OrdersChartDto> {
  const [series, distribution] = await Promise.all([
    getDailySeries(storeId, range),
    db
      .select({ status: orders.status, count: count() })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), inRange(range)))
      .groupBy(orders.status)
      .orderBy(desc(count()), orders.status),
  ]);

  const points = series.map((r) => ({ day: r.day, orders: r.orders }));
  const total = points.reduce((sum, p) => sum + p.orders, 0);

  return {
    points,
    total,
    statusDistribution: distribution.map((d) => ({
      status: d.status,
      count: num(d.count),
    })),
  };
}

/** Most recent orders (all statuses), newest first with a stable tiebreaker. */
export async function getRecentOrders(
  storeId: string,
  limit: number,
): Promise<RecentOrderDto[]> {
  const rows = await db
    .select({
      id: orders.id,
      wpOrderId: orders.wpOrderId,
      orderNumber: orders.orderNumber,
      status: orders.status,
      total: orders.total,
      currency: orders.currency,
      placedAt: orders.placedAt,
      createdAt: orders.createdAt,
      customerName: customers.name,
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.storeId, storeId))
    .orderBy(sql`${orderDate} desc`, desc(orders.id))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    wpOrderId: r.wpOrderId,
    orderNumber: r.orderNumber,
    status: r.status,
    total: r.total,
    currency: r.currency,
    customerName: r.customerName ?? null,
    orderDate: iso(r.placedAt ?? r.createdAt),
  }));
}

/** Top products by paid revenue (quantity as tiebreaker) within the range. */
export async function getTopProducts(
  storeId: string,
  range: ResolvedRange,
  limit: number,
): Promise<TopProductDto[]> {
  const revenueSum = sql<string>`coalesce(sum(${orderItems.total}), 0)`;
  const quantitySum = sql<number>`coalesce(sum(${orderItems.quantity}), 0)`;

  const rows = await db
    .select({
      productId: orderItems.productId,
      name: orderItems.name,
      quantity: quantitySum,
      revenue: revenueSum,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orderItems.storeId, storeId),
        inArray(orders.status, PAID),
        inRange(range),
      ),
    )
    .groupBy(orderItems.productId, orderItems.name)
    .orderBy(desc(revenueSum), desc(quantitySum), orderItems.name)
    .limit(limit);

  return rows.map((r) => ({
    productId: r.productId,
    name: r.name,
    quantity: num(r.quantity),
    revenue: money(r.revenue),
  }));
}

/** Active products at or below the low-stock threshold, lowest stock first. */
export async function getLowStock(
  storeId: string,
  limit: number,
  threshold: number,
): Promise<LowStockProductDto[]> {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      stockQuantity: products.stockQuantity,
      status: products.status,
      price: products.price,
    })
    .from(products)
    .where(
      and(
        eq(products.storeId, storeId),
        eq(products.status, "active"),
        lt(products.stockQuantity, threshold + 1),
      ),
    )
    .orderBy(products.stockQuantity, products.name, products.id)
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    stockQuantity: r.stockQuantity,
    status: r.status,
    price: r.price,
  }));
}
