import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  sql,
  type AnyColumn,
  type SQL,
} from "drizzle-orm";
import { db } from "../../db";
import { codeAssignments } from "../../db/schema/code-assignments";
import { codeBatches } from "../../db/schema/code-batches";
import { digitalCodes } from "../../db/schema/digital-codes";
import { digitalDeliveries } from "../../db/schema/digital-deliveries";
import { digitalProductSettings } from "../../db/schema/digital-product-settings";
import { orderItems } from "../../db/schema/order-items";
import { orders } from "../../db/schema/orders";
import { products } from "../../db/schema/products";
import { suppliers } from "../../db/schema/suppliers";
import { REVENUE_STATUSES } from "../dashboard/dashboard.service";
import {
  resolveDateRange,
  type ReportFilters,
  type ResolvedDateRange,
  type StockReportQuery,
} from "./digital-reports.schemas";
import { average, num, stockStatus } from "./digital-reports.math";
import {
  toProfitRowDto,
  toProfitTotalsDto,
  toSupplierPerformanceDto,
  type DeliveryReportDto,
  type DigitalSummaryDto,
  type InventoryReportRowDto,
  type ProfitReportRowDto,
  type ProfitReportTotalsDto,
  type ProfitRowInput,
  type StockHealthDto,
  type StockHealthRowDto,
  type SupplierPerformanceRowDto,
} from "./digital-reports.serializer";

/** Order statuses that count as realised revenue (shared with the dashboard). */
const PAID = [...REVENUE_STATUSES];

/** Effective order date: WooCommerce placed-at when known, else our created-at. */
const orderDate = sql`coalesce(${orders.placedAt}, ${orders.createdAt})`;

/** Per-code cost basis: the code's own cost, else its batch's per-code cost. */
const codeCostExpr = sql`coalesce(${digitalCodes.costPrice}, ${codeBatches.costPerCode})`;

/** Consumed codes: sold or delivered (i.e. removed from sellable stock). */
const CONSUMED_STATUSES = ["sold", "delivered"] as const;

/** Builds inclusive-of-start, exclusive-of-end conditions for a timestamp column. */
function dateConditions(
  column: AnyColumn | SQL,
  range: ResolvedDateRange,
): SQL[] {
  // Wrap in `sql` so a plain column and a coalesce() expression share one type.
  const col = sql`${column}`;
  const conds: SQL[] = [];
  if (range.start) conds.push(gte(col, range.start));
  if (range.end) conds.push(lt(col, range.end));
  return conds;
}

/* ================================ Profit ================================= */

interface ProfitReportResult {
  rows: ProfitReportRowDto[];
  totals: ProfitReportTotalsDto;
  currency: string;
}

/**
 * Per-product sales & profit within the date range (plan2 §21 "Sales/Profit").
 *
 * Revenue comes from `order_items` of paid orders whose product is digital
 * (settings.is_enabled), by effective order date. Cost comes from the codes
 * CONSUMED (sold/delivered) in range — `coalesce(code.cost_price,
 * batch.cost_per_code)`. Unknown cost is tracked, never zeroed: a product's
 * gross profit is only reported when every consumed code had a known cost.
 *
 * Applies: dateFrom/dateTo, productId, currency. (The supplier dimension lives in
 * the supplier-performance report; `status` is fixed to the paid set here.)
 * Tenant-scoped throughout; four grouped aggregates — no per-row queries.
 */
export async function getProfitReport(
  storeId: string,
  filters: ReportFilters,
): Promise<ProfitReportResult> {
  const range = resolveDateRange(filters);

  const revenueConds: SQL[] = [
    eq(orderItems.storeId, storeId),
    inArray(orders.status, PAID),
    eq(digitalProductSettings.isEnabled, true),
    ...dateConditions(orderDate, range),
  ];
  if (filters.productId) revenueConds.push(eq(orderItems.productId, filters.productId));
  if (filters.currency) revenueConds.push(eq(orders.currency, filters.currency));

  const refundConds: SQL[] = [
    eq(orderItems.storeId, storeId),
    eq(orders.status, "refunded"),
    eq(digitalProductSettings.isEnabled, true),
    ...dateConditions(orderDate, range),
  ];
  if (filters.productId) refundConds.push(eq(orderItems.productId, filters.productId));
  if (filters.currency) refundConds.push(eq(orders.currency, filters.currency));

  const costConds: SQL[] = [
    eq(digitalCodes.storeId, storeId),
    inArray(digitalCodes.status, [...CONSUMED_STATUSES]),
    ...dateConditions(digitalCodes.soldAt, range),
  ];
  if (filters.productId) costConds.push(eq(digitalCodes.productId, filters.productId));

  const replacementConds: SQL[] = [
    eq(codeAssignments.storeId, storeId),
    eq(codeAssignments.assignmentType, "replacement"),
    ...dateConditions(codeAssignments.assignedAt, range),
  ];
  if (filters.productId) {
    replacementConds.push(eq(codeAssignments.productId, filters.productId));
  }

  const [revenueRows, costRows, refundRows, replacementRows, currencyRow] =
    await Promise.all([
      db
        .select({
          productId: orderItems.productId,
          productName: sql<string | null>`max(${products.name})`,
          units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`,
          revenue: sql<string>`coalesce(sum(${orderItems.total}), 0)`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .innerJoin(
          digitalProductSettings,
          and(
            eq(digitalProductSettings.storeId, orderItems.storeId),
            eq(digitalProductSettings.productId, orderItems.productId),
          ),
        )
        .leftJoin(products, eq(products.id, orderItems.productId))
        .where(and(...revenueConds))
        .groupBy(orderItems.productId),
      db
        .select({
          productId: digitalCodes.productId,
          productName: sql<string | null>`max(${products.name})`,
          knownCost: sql<string>`coalesce(sum(${codeCostExpr}) filter (where ${codeCostExpr} is not null), 0)`,
          consumed: count(),
          unknownCost: sql<number>`count(*) filter (where ${codeCostExpr} is null)`,
        })
        .from(digitalCodes)
        .leftJoin(codeBatches, eq(codeBatches.id, digitalCodes.batchId))
        .leftJoin(products, eq(products.id, digitalCodes.productId))
        .where(and(...costConds))
        .groupBy(digitalCodes.productId),
      db
        .select({
          productId: orderItems.productId,
          refundCount: sql<number>`count(distinct ${orders.id})`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .innerJoin(
          digitalProductSettings,
          and(
            eq(digitalProductSettings.storeId, orderItems.storeId),
            eq(digitalProductSettings.productId, orderItems.productId),
          ),
        )
        .where(and(...refundConds))
        .groupBy(orderItems.productId),
      db
        .select({
          productId: codeAssignments.productId,
          replacementCount: count(),
        })
        .from(codeAssignments)
        .where(and(...replacementConds))
        .groupBy(codeAssignments.productId),
      db
        .select({ currency: orders.currency })
        .from(orders)
        .where(eq(orders.storeId, storeId))
        .orderBy(sql`${orderDate} desc`, desc(orders.id))
        .limit(1),
    ]);

  const inputs = new Map<string, ProfitRowInput>();
  const ensure = (productId: string, name: string | null): ProfitRowInput => {
    let row = inputs.get(productId);
    if (!row) {
      row = {
        productId,
        productName: name,
        unitsSold: 0,
        revenue: 0,
        knownCost: 0,
        consumedCodes: 0,
        codesWithUnknownCost: 0,
        refundCount: 0,
        replacementCount: 0,
      };
      inputs.set(productId, row);
    } else if (row.productName === null && name !== null) {
      row.productName = name;
    }
    return row;
  };

  for (const r of revenueRows) {
    if (!r.productId) continue;
    const row = ensure(r.productId, r.productName);
    row.unitsSold = num(r.units);
    row.revenue = num(r.revenue);
  }
  for (const r of costRows) {
    if (!r.productId) continue;
    const row = ensure(r.productId, r.productName);
    row.knownCost = num(r.knownCost);
    row.consumedCodes = num(r.consumed);
    row.codesWithUnknownCost = num(r.unknownCost);
  }
  for (const r of refundRows) {
    if (!r.productId) continue;
    ensure(r.productId, null).refundCount = num(r.refundCount);
  }
  for (const r of replacementRows) {
    if (!r.productId) continue;
    ensure(r.productId, null).replacementCount = num(r.replacementCount);
  }

  const rows = [...inputs.values()]
    .map(toProfitRowDto)
    .sort(
      (a, b) =>
        num(b.revenue) - num(a.revenue) ||
        (a.productName ?? "").localeCompare(b.productName ?? ""),
    );

  return {
    rows,
    totals: toProfitTotalsDto(rows),
    currency: filters.currency ?? currencyRow[0]?.currency ?? "SAR",
  };
}

/* ================================ Summary =============================== */

/**
 * High-level digital operations + financial summary (plan2 §21 "Summary" plus the
 * financial-summary metrics). Reuses the profit aggregation for revenue/cost/
 * profit, then adds code, product, delivery and assignment counters. Tenant-scoped.
 */
export async function getDigitalSummary(
  storeId: string,
  filters: ReportFilters,
): Promise<DigitalSummaryDto> {
  const range = resolveDateRange(filters);
  const profit = await getProfitReport(storeId, filters);

  const codeConds: SQL[] = [eq(digitalCodes.storeId, storeId)];
  if (filters.productId) codeConds.push(eq(digitalCodes.productId, filters.productId));
  if (filters.supplierId) codeConds.push(eq(digitalCodes.supplierId, filters.supplierId));

  const productConds: SQL[] = [
    eq(digitalProductSettings.storeId, storeId),
    eq(digitalProductSettings.isEnabled, true),
  ];
  if (filters.productId) {
    productConds.push(eq(digitalProductSettings.productId, filters.productId));
  }

  const deliveryConds: SQL[] = [
    eq(digitalDeliveries.storeId, storeId),
    ...dateConditions(digitalDeliveries.createdAt, range),
  ];

  const assignmentConds: SQL[] = [
    eq(codeAssignments.storeId, storeId),
    ...dateConditions(codeAssignments.assignedAt, range),
  ];
  if (filters.productId) {
    assignmentConds.push(eq(codeAssignments.productId, filters.productId));
  }

  const digitalOrderConds: SQL[] = [
    eq(orderItems.storeId, storeId),
    inArray(orders.status, PAID),
    eq(digitalProductSettings.isEnabled, true),
    ...dateConditions(orderDate, range),
  ];
  if (filters.productId) {
    digitalOrderConds.push(eq(orderItems.productId, filters.productId));
  }
  if (filters.currency) digitalOrderConds.push(eq(orders.currency, filters.currency));

  const deliveredOrderConds: SQL[] = [
    eq(orders.storeId, storeId),
    eq(orders.digitalDeliveryStatus, "completed"),
    ...dateConditions(orders.createdAt, range),
  ];
  if (filters.currency) deliveredOrderConds.push(eq(orders.currency, filters.currency));

  const [codeAgg, productAgg, lowStockAgg, deliveryAgg, assignmentAgg, digitalOrdersRow, deliveredOrdersRow] =
    await Promise.all([
      db
        .select({
          available: sql<number>`count(*) filter (where ${digitalCodes.status} = 'available')`,
          sold: sql<number>`count(*) filter (where ${digitalCodes.status} = 'sold')`,
          delivered: sql<number>`count(*) filter (where ${digitalCodes.status} = 'delivered')`,
        })
        .from(digitalCodes)
        .where(and(...codeConds)),
      db
        .select({ value: count() })
        .from(digitalProductSettings)
        .where(and(...productConds)),
      lowStockProductCount(storeId, filters.productId),
      db
        .select({
          failed: sql<number>`count(*) filter (where ${digitalDeliveries.status} = 'failed')`,
        })
        .from(digitalDeliveries)
        .where(and(...deliveryConds)),
      db
        .select({
          total: count(),
          replacement: sql<number>`count(*) filter (where ${codeAssignments.assignmentType} = 'replacement')`,
        })
        .from(codeAssignments)
        .where(and(...assignmentConds)),
      db
        .select({ value: sql<number>`count(distinct ${orders.id})` })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .innerJoin(
          digitalProductSettings,
          and(
            eq(digitalProductSettings.storeId, orderItems.storeId),
            eq(digitalProductSettings.productId, orderItems.productId),
          ),
        )
        .where(and(...digitalOrderConds)),
      db
        .select({ value: count() })
        .from(orders)
        .where(and(...deliveredOrderConds)),
    ]);

  const assignmentsTotal = num(assignmentAgg[0]?.total);
  const replacements = num(assignmentAgg[0]?.replacement);
  const profitPercent = profit.totals.grossMargin;

  return {
    totalDigitalProducts: num(productAgg[0]?.value),
    availableCodes: num(codeAgg[0]?.available),
    soldCodes: num(codeAgg[0]?.sold),
    deliveredCodes: num(codeAgg[0]?.delivered),
    lowStockProducts: lowStockAgg,
    failedDeliveries: num(deliveryAgg[0]?.failed),
    replacementRate:
      assignmentsTotal > 0
        ? Math.round((replacements / assignmentsTotal) * 10000) / 10000
        : 0,
    digitalOrders: num(digitalOrdersRow[0]?.value),
    deliveredOrders: num(deliveredOrdersRow[0]?.value),
    revenue: profit.totals.revenue,
    purchaseCost: profit.totals.purchaseCost,
    grossProfit: profit.totals.grossProfit,
    profitPercent,
    currency: profit.currency,
  };
}

/** Count of digital-enabled products whose available pool is at/under threshold. */
async function lowStockProductCount(
  storeId: string,
  productId?: string,
): Promise<number> {
  const available = sql<number>`count(${digitalCodes.id}) filter (where ${digitalCodes.status} = 'available')`;
  const conds: SQL[] = [
    eq(digitalProductSettings.storeId, storeId),
    eq(digitalProductSettings.isEnabled, true),
  ];
  if (productId) conds.push(eq(digitalProductSettings.productId, productId));

  const rows = await db
    .select({ productId: digitalProductSettings.productId })
    .from(digitalProductSettings)
    .leftJoin(
      digitalCodes,
      and(
        eq(digitalCodes.productId, digitalProductSettings.productId),
        eq(digitalCodes.storeId, digitalProductSettings.storeId),
      ),
    )
    .where(and(...conds))
    .groupBy(digitalProductSettings.productId, digitalProductSettings.lowStockThreshold)
    .having(sql`${available} <= ${digitalProductSettings.lowStockThreshold}`);

  return rows.length;
}

/* =============================== Inventory ============================== */

/**
 * Per-product inventory health snapshot (plan2 §21 "Inventory"). One row per
 * digital-enabled product with its status breakdown + stock status. A snapshot,
 * so it applies only the product/supplier filters (not the date range).
 * Tenant-scoped; a single grouped aggregate.
 */
export async function getInventoryReport(
  storeId: string,
  filters: ReportFilters,
): Promise<InventoryReportRowDto[]> {
  const codeJoin: SQL[] = [
    eq(digitalCodes.productId, digitalProductSettings.productId),
    eq(digitalCodes.storeId, digitalProductSettings.storeId),
  ];
  if (filters.supplierId) {
    codeJoin.push(eq(digitalCodes.supplierId, filters.supplierId));
  }

  const conds: SQL[] = [
    eq(digitalProductSettings.storeId, storeId),
    eq(digitalProductSettings.isEnabled, true),
  ];
  if (filters.productId) {
    conds.push(eq(digitalProductSettings.productId, filters.productId));
  }

  const rows = await db
    .select({
      productId: digitalProductSettings.productId,
      productName: sql<string | null>`max(${products.name})`,
      threshold: digitalProductSettings.lowStockThreshold,
      available: sql<number>`count(${digitalCodes.id}) filter (where ${digitalCodes.status} = 'available')`,
      reserved: sql<number>`count(${digitalCodes.id}) filter (where ${digitalCodes.status} = 'reserved')`,
      sold: sql<number>`count(${digitalCodes.id}) filter (where ${digitalCodes.status} = 'sold')`,
      delivered: sql<number>`count(${digitalCodes.id}) filter (where ${digitalCodes.status} = 'delivered')`,
      invalid: sql<number>`count(${digitalCodes.id}) filter (where ${digitalCodes.status} = 'invalid')`,
      voided: sql<number>`count(${digitalCodes.id}) filter (where ${digitalCodes.status} = 'voided')`,
    })
    .from(digitalProductSettings)
    .innerJoin(products, eq(products.id, digitalProductSettings.productId))
    .leftJoin(digitalCodes, and(...codeJoin))
    .where(and(...conds))
    .groupBy(
      digitalProductSettings.productId,
      digitalProductSettings.lowStockThreshold,
    );

  return rows
    .map((r) => ({
      productId: r.productId,
      productName: r.productName,
      available: num(r.available),
      reserved: num(r.reserved),
      sold: num(r.sold),
      delivered: num(r.delivered),
      invalid: num(r.invalid),
      voided: num(r.voided),
      lowStockThreshold: r.threshold,
      stockStatus: stockStatus(num(r.available), r.threshold),
    }))
    .sort(
      (a, b) =>
        a.available - b.available ||
        (a.productName ?? "").localeCompare(b.productName ?? ""),
    );
}

/* =========================== Supplier performance ====================== */

/**
 * Per-supplier performance (plan2 §21 "Supplier Performance"). Codes & cost from
 * `digital_codes`; replacement count + best-effort revenue from
 * `code_assignments` → `order_items.price`. When a date range is given it scopes
 * the codes by import date (created_at). Tenant-scoped; two grouped aggregates +
 * a supplier-name lookup — no per-row queries.
 */
export async function getSupplierPerformance(
  storeId: string,
  filters: ReportFilters,
): Promise<SupplierPerformanceRowDto[]> {
  const range = resolveDateRange(filters);

  const codeConds: SQL[] = [
    eq(digitalCodes.storeId, storeId),
    isNotNull(digitalCodes.supplierId),
    ...dateConditions(digitalCodes.createdAt, range),
  ];
  if (filters.supplierId) codeConds.push(eq(digitalCodes.supplierId, filters.supplierId));

  const assignmentConds: SQL[] = [
    eq(codeAssignments.storeId, storeId),
    inArray(codeAssignments.status, ["assigned", "delivered"]),
    isNotNull(digitalCodes.supplierId),
  ];
  if (filters.supplierId) {
    assignmentConds.push(eq(digitalCodes.supplierId, filters.supplierId));
  }

  const [codeRows, assignmentRows] = await Promise.all([
    db
      .select({
        supplierId: digitalCodes.supplierId,
        imported: count(),
        sold: sql<number>`count(*) filter (where ${digitalCodes.status} in ('sold','delivered'))`,
        delivered: sql<number>`count(*) filter (where ${digitalCodes.status} = 'delivered')`,
        invalid: sql<number>`count(*) filter (where ${digitalCodes.status} = 'invalid')`,
        knownCost: sql<string | null>`sum(${codeCostExpr}) filter (where ${codeCostExpr} is not null)`,
      })
      .from(digitalCodes)
      .leftJoin(codeBatches, eq(codeBatches.id, digitalCodes.batchId))
      .where(and(...codeConds))
      .groupBy(digitalCodes.supplierId),
    db
      .select({
        supplierId: digitalCodes.supplierId,
        replacement: sql<number>`count(*) filter (where ${codeAssignments.assignmentType} = 'replacement')`,
        revenue: sql<string | null>`sum(${orderItems.price})`,
      })
      .from(codeAssignments)
      .innerJoin(digitalCodes, eq(digitalCodes.id, codeAssignments.codeId))
      .leftJoin(orderItems, eq(orderItems.id, codeAssignments.orderItemId))
      .where(and(...assignmentConds))
      .groupBy(digitalCodes.supplierId),
  ]);

  const supplierIds = codeRows
    .map((r) => r.supplierId)
    .filter((id): id is string => id !== null);
  if (supplierIds.length === 0) return [];

  const supplierRows = await db
    .select({ id: suppliers.id, name: suppliers.name, currency: suppliers.currency })
    .from(suppliers)
    .where(and(eq(suppliers.storeId, storeId), inArray(suppliers.id, supplierIds)));
  const supplierById = new Map(supplierRows.map((s) => [s.id, s]));

  const assignmentById = new Map(
    assignmentRows
      .filter((r) => r.supplierId)
      .map((r) => [r.supplierId as string, r]),
  );

  return codeRows
    .filter((r) => r.supplierId && supplierById.has(r.supplierId))
    .map((r) => {
      const supplier = supplierById.get(r.supplierId as string)!;
      const extra = assignmentById.get(r.supplierId as string);
      return toSupplierPerformanceDto({
        supplierId: supplier.id,
        supplierName: supplier.name,
        currency: supplier.currency,
        codesImported: num(r.imported),
        codesSold: num(r.sold),
        codesDelivered: num(r.delivered),
        codesInvalid: num(r.invalid),
        replacementCount: num(extra?.replacement),
        estimatedCost: r.knownCost === null ? null : num(r.knownCost),
        estimatedRevenue:
          extra?.revenue === undefined || extra.revenue === null
            ? null
            : num(extra.revenue),
      });
    })
    .sort((a, b) => b.codesImported - a.codesImported);
}

/* =============================== Delivery ============================== */

/**
 * Delivery success/failure report (plan2 §21 "Delivery"). Aggregates
 * `digital_deliveries` by outcome, plus failed-by-channel. Applies the date range
 * (on created_at). Tenant-scoped; two scalar/grouped aggregates.
 */
export async function getDeliveryReport(
  storeId: string,
  filters: ReportFilters,
): Promise<DeliveryReportDto> {
  const range = resolveDateRange(filters);
  const conds: SQL[] = [
    eq(digitalDeliveries.storeId, storeId),
    ...dateConditions(digitalDeliveries.createdAt, range),
  ];

  const [mainRows, channelRows] = await Promise.all([
    db
      .select({
        total: count(),
        completed: sql<number>`count(*) filter (where ${digitalDeliveries.status} = 'completed')`,
        pending: sql<number>`count(*) filter (where ${digitalDeliveries.status} = 'pending')`,
        processing: sql<number>`count(*) filter (where ${digitalDeliveries.status} = 'processing')`,
        failed: sql<number>`count(*) filter (where ${digitalDeliveries.status} = 'failed')`,
        manualReview: sql<number>`count(*) filter (where ${digitalDeliveries.status} = 'manual_review')`,
        cancelled: sql<number>`count(*) filter (where ${digitalDeliveries.status} = 'cancelled')`,
        manualDeliveries: sql<number>`count(*) filter (where ${digitalDeliveries.channel} = 'manual')`,
        totalAttempts: sql<number>`coalesce(sum(${digitalDeliveries.attemptCount}), 0)`,
        retries: sql<number>`coalesce(sum(greatest(${digitalDeliveries.attemptCount} - 1, 0)), 0)`,
        avgSeconds: sql<string | null>`avg(extract(epoch from (${digitalDeliveries.completedAt} - ${digitalDeliveries.createdAt}))) filter (where ${digitalDeliveries.status} = 'completed' and ${digitalDeliveries.completedAt} is not null)`,
      })
      .from(digitalDeliveries)
      .where(and(...conds)),
    db
      .select({ channel: digitalDeliveries.channel, value: count() })
      .from(digitalDeliveries)
      .where(and(...conds, eq(digitalDeliveries.status, "failed")))
      .groupBy(digitalDeliveries.channel)
      .orderBy(desc(count()), digitalDeliveries.channel),
  ]);

  const m = mainRows[0];
  const total = num(m?.total);
  const avgSeconds = m?.avgSeconds;

  return {
    totalDeliveries: total,
    completed: num(m?.completed),
    pending: num(m?.pending),
    processing: num(m?.processing),
    failed: num(m?.failed),
    manualReview: num(m?.manualReview),
    cancelled: num(m?.cancelled),
    manualDeliveries: num(m?.manualDeliveries),
    retries: num(m?.retries),
    averageAttempts: average(num(m?.totalAttempts), total),
    averageDeliverySeconds:
      avgSeconds === null || avgSeconds === undefined
        ? null
        : Math.round(num(avgSeconds)),
    failedByChannel: channelRows.map((r) => ({
      channel: r.channel,
      count: num(r.value),
    })),
  };
}

/* ============================== Stock health =========================== */

/**
 * Stock-health report (plan2 §21 "Low Stock"). Per-product available pool vs
 * threshold (out/low/healthy) + a count of available codes expiring soon. A
 * snapshot, so date filters don't apply; honours product/supplier filters and the
 * `expiringWithinDays` window. Tenant-scoped; two grouped aggregates.
 */
export async function getStockHealth(
  storeId: string,
  query: StockReportQuery,
): Promise<StockHealthDto> {
  const codeJoin: SQL[] = [
    eq(digitalCodes.productId, digitalProductSettings.productId),
    eq(digitalCodes.storeId, digitalProductSettings.storeId),
  ];
  if (query.supplierId) codeJoin.push(eq(digitalCodes.supplierId, query.supplierId));

  const productConds: SQL[] = [
    eq(digitalProductSettings.storeId, storeId),
    eq(digitalProductSettings.isEnabled, true),
  ];
  if (query.productId) {
    productConds.push(eq(digitalProductSettings.productId, query.productId));
  }

  const expiringConds: SQL[] = [
    eq(digitalCodes.storeId, storeId),
    eq(digitalCodes.status, "available"),
    isNotNull(digitalCodes.expiresAt),
    gte(digitalCodes.expiresAt, sql`now()`),
    lt(
      digitalCodes.expiresAt,
      sql`now() + (${query.expiringWithinDays} * interval '1 day')`,
    ),
  ];
  if (query.productId) expiringConds.push(eq(digitalCodes.productId, query.productId));
  if (query.supplierId) expiringConds.push(eq(digitalCodes.supplierId, query.supplierId));

  const [productRows, expiringRows] = await Promise.all([
    db
      .select({
        productId: digitalProductSettings.productId,
        productName: sql<string | null>`max(${products.name})`,
        threshold: digitalProductSettings.lowStockThreshold,
        available: sql<number>`count(${digitalCodes.id}) filter (where ${digitalCodes.status} = 'available')`,
      })
      .from(digitalProductSettings)
      .innerJoin(products, eq(products.id, digitalProductSettings.productId))
      .leftJoin(digitalCodes, and(...codeJoin))
      .where(and(...productConds))
      .groupBy(
        digitalProductSettings.productId,
        digitalProductSettings.lowStockThreshold,
      ),
    db
      .select({
        productId: digitalCodes.productId,
        productName: sql<string | null>`max(${products.name})`,
        count: count(),
        earliest: sql<Date | null>`min(${digitalCodes.expiresAt})`,
      })
      .from(digitalCodes)
      .leftJoin(products, eq(products.id, digitalCodes.productId))
      .where(and(...expiringConds))
      .groupBy(digitalCodes.productId),
  ]);

  const products_: StockHealthRowDto[] = productRows
    .map((r) => ({
      productId: r.productId,
      productName: r.productName,
      available: num(r.available),
      lowStockThreshold: r.threshold,
      stockStatus: stockStatus(num(r.available), r.threshold),
    }))
    .sort(
      (a, b) =>
        a.available - b.available ||
        (a.productName ?? "").localeCompare(b.productName ?? ""),
    );

  const outOfStockCount = products_.filter((p) => p.stockStatus === "out_of_stock").length;
  const lowStockCount = products_.filter((p) => p.stockStatus === "low").length;

  let expiringCodesCount = 0;
  const expiringProducts = expiringRows.map((r) => {
    const c = num(r.count);
    expiringCodesCount += c;
    return {
      productId: r.productId,
      productName: r.productName,
      count: c,
      earliestExpiry: r.earliest ? new Date(r.earliest) : null,
    };
  });
  expiringProducts.sort((a, b) => {
    const at = a.earliestExpiry?.getTime() ?? Infinity;
    const bt = b.earliestExpiry?.getTime() ?? Infinity;
    return at - bt;
  });

  return {
    products: products_,
    outOfStockCount,
    lowStockCount,
    belowThresholdCount: outOfStockCount + lowStockCount,
    expiringWithinDays: query.expiringWithinDays,
    expiringCodesCount,
    expiringProducts,
  };
}
