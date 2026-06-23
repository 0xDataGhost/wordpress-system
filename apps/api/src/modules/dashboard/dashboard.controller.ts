import type { Request, Response } from "express";
import { env } from "../../config/env";
import { successResponse } from "../../lib/api-response";
import { getAuth } from "../../middleware/authenticate";
import { cacheKey, getCached } from "./dashboard.cache";
import { dayKey, resolveRange } from "./dashboard.range";
import {
  getLowStock,
  getOrdersChart,
  getRecentOrders,
  getSalesChart,
  getSummary,
  getTopProducts,
} from "./dashboard.service";
import type {
  LowStockQuery,
  RangeQuery,
  RecentOrdersQuery,
  SummaryQuery,
  TopProductsQuery,
} from "./dashboard.schemas";

/** GET /dashboard/summary — fixed-period KPIs (dashboard.view). */
export async function summaryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { storeId } = getAuth(req);
  const { refresh } = req.query as unknown as SummaryQuery;
  const now = new Date();
  const data = await getCached(
    cacheKey(storeId, "summary", dayKey(now)),
    refresh,
    () => getSummary(storeId, now),
  );
  res.status(200).json(successResponse(data, ""));
}

/** GET /dashboard/sales-chart — revenue over time (dashboard.view). */
export async function salesChartHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { storeId } = getAuth(req);
  const query = req.query as unknown as RangeQuery;
  const range = resolveRange(query, new Date());
  const data = await getCached(
    cacheKey(storeId, "sales-chart", range.rangeKey),
    query.refresh,
    () => getSalesChart(storeId, range),
  );
  res.status(200).json(successResponse(data, ""));
}

/** GET /dashboard/orders-chart — orders over time + status distribution (dashboard.view). */
export async function ordersChartHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { storeId } = getAuth(req);
  const query = req.query as unknown as RangeQuery;
  const range = resolveRange(query, new Date());
  const data = await getCached(
    cacheKey(storeId, "orders-chart", range.rangeKey),
    query.refresh,
    () => getOrdersChart(storeId, range),
  );
  res.status(200).json(successResponse(data, ""));
}

/** GET /dashboard/recent-orders — latest orders (dashboard.view). */
export async function recentOrdersHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { storeId } = getAuth(req);
  const { limit, refresh } = req.query as unknown as RecentOrdersQuery;
  const data = await getCached(
    cacheKey(storeId, "recent-orders", limit),
    refresh,
    () => getRecentOrders(storeId, limit),
  );
  res.status(200).json(successResponse(data, ""));
}

/** GET /dashboard/top-products — top products by paid revenue (dashboard.view). */
export async function topProductsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { storeId } = getAuth(req);
  const query = req.query as unknown as TopProductsQuery;
  const range = resolveRange(query, new Date());
  const data = await getCached(
    cacheKey(storeId, "top-products", range.rangeKey, query.limit),
    query.refresh,
    () => getTopProducts(storeId, range, query.limit),
  );
  res.status(200).json(successResponse(data, ""));
}

/** GET /dashboard/low-stock — active products at/below the threshold (dashboard.view). */
export async function lowStockHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { storeId } = getAuth(req);
  const { limit, threshold, refresh } = req.query as unknown as LowStockQuery;
  const effectiveThreshold = threshold ?? env.DASHBOARD_LOW_STOCK_THRESHOLD;
  const data = await getCached(
    cacheKey(storeId, "low-stock", limit, effectiveThreshold),
    refresh,
    () => getLowStock(storeId, limit, effectiveThreshold),
  );
  res.status(200).json(successResponse(data, ""));
}
