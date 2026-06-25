/**
 * Public DTOs for the Phase 21 digital reports.
 *
 * SECURITY: these reports are aggregate analytics only. No DTO here ever carries
 * a raw/decrypted code, encrypted material, or a code fingerprint — the reports
 * operate purely on counts, costs, statuses, and timestamps.
 *
 * All money values are exact 2-decimal strings (or null when unknown); all rates
 * are numbers; all timestamps are passed through as the DB returns them.
 */

import {
  average,
  grossMargin,
  grossProfit,
  money,
  num,
  rate,
  type StockStatus,
} from "./digital-reports.math";

/* --------------------------------- Summary ------------------------------- */

export interface DigitalSummaryDto {
  /** Digital-enabled products (settings.is_enabled). */
  totalDigitalProducts: number;
  availableCodes: number;
  soldCodes: number;
  deliveredCodes: number;
  /** Digital-enabled products at/under their low-stock threshold. */
  lowStockProducts: number;
  failedDeliveries: number;
  /** replacement assignments / all assignments, 0..1 (4 dp). */
  replacementRate: number;
  /** Distinct paid orders that contain at least one digital line in range. */
  digitalOrders: number;
  /** Orders whose digital delivery is marked completed (in range). */
  deliveredOrders: number;
  revenue: string;
  purchaseCost: string | null;
  grossProfit: string | null;
  /** profit / revenue as a percentage (2 dp), or null when unknown. */
  profitPercent: number | null;
  currency: string;
}

/* -------------------------------- Inventory ------------------------------ */

export interface InventoryReportRowDto {
  productId: string;
  productName: string | null;
  available: number;
  reserved: number;
  sold: number;
  delivered: number;
  invalid: number;
  voided: number;
  lowStockThreshold: number;
  stockStatus: StockStatus;
}

/* --------------------------------- Profit -------------------------------- */

export interface ProfitReportRowDto {
  productId: string;
  productName: string | null;
  unitsSold: number;
  revenue: string;
  /** Sum of KNOWN per-code costs for codes consumed in range; null if none known. */
  purchaseCost: string | null;
  /** True iff every consumed code in range had a known cost (≥1 consumed). */
  costComplete: boolean;
  consumedCodes: number;
  codesWithUnknownCost: number;
  grossProfit: string | null;
  grossMargin: number | null;
  averageCost: string | null;
  averageSellingPrice: string;
  refundCount: number;
  replacementCount: number;
}

export interface ProfitReportTotalsDto {
  unitsSold: number;
  revenue: string;
  purchaseCost: string | null;
  grossProfit: string | null;
  grossMargin: number | null;
  refundCount: number;
  replacementCount: number;
}

/** Aggregated inputs the service has already summed per product. */
export interface ProfitRowInput {
  productId: string;
  productName: string | null;
  unitsSold: number;
  revenue: number;
  /** Sum of known costs (consumed codes with a cost). */
  knownCost: number;
  consumedCodes: number;
  codesWithUnknownCost: number;
  refundCount: number;
  replacementCount: number;
}

/** Builds a per-product profit row, applying the unknown-cost policy. */
export function toProfitRowDto(input: ProfitRowInput): ProfitReportRowDto {
  const costComplete =
    input.consumedCodes > 0 && input.codesWithUnknownCost === 0;
  const purchaseCost =
    input.consumedCodes - input.codesWithUnknownCost > 0
      ? money(input.knownCost)
      : null;
  const profit = costComplete
    ? grossProfit(input.revenue, input.knownCost)
    : null;
  const codesWithKnownCost = input.consumedCodes - input.codesWithUnknownCost;

  return {
    productId: input.productId,
    productName: input.productName,
    unitsSold: input.unitsSold,
    revenue: money(input.revenue),
    purchaseCost,
    costComplete,
    consumedCodes: input.consumedCodes,
    codesWithUnknownCost: input.codesWithUnknownCost,
    grossProfit: profit === null ? null : money(profit),
    grossMargin: grossMargin(input.revenue, profit),
    averageCost:
      codesWithKnownCost > 0 ? average(input.knownCost, codesWithKnownCost) : null,
    averageSellingPrice: average(input.revenue, input.unitsSold),
    refundCount: input.refundCount,
    replacementCount: input.replacementCount,
  };
}

/** Aggregates per-product rows into report totals. */
export function toProfitTotalsDto(
  rows: ProfitReportRowDto[],
): ProfitReportTotalsDto {
  let unitsSold = 0;
  let revenue = 0;
  let knownCost = 0;
  let refundCount = 0;
  let replacementCount = 0;
  let allCostComplete = rows.length > 0;

  for (const row of rows) {
    unitsSold += row.unitsSold;
    revenue += num(row.revenue);
    if (row.purchaseCost !== null) knownCost += num(row.purchaseCost);
    if (!row.costComplete) allCostComplete = false;
    refundCount += row.refundCount;
    replacementCount += row.replacementCount;
  }

  const profit = allCostComplete ? grossProfit(revenue, knownCost) : null;

  return {
    unitsSold,
    revenue: money(revenue),
    purchaseCost: allCostComplete ? money(knownCost) : null,
    grossProfit: profit === null ? null : money(profit),
    grossMargin: grossMargin(revenue, profit),
    refundCount,
    replacementCount,
  };
}

/* ---------------------------- Supplier performance ----------------------- */

export interface SupplierPerformanceRowDto {
  supplierId: string;
  supplierName: string;
  codesImported: number;
  codesSold: number;
  codesDelivered: number;
  codesInvalid: number;
  replacementCount: number;
  invalidRate: number;
  estimatedCost: string | null;
  estimatedRevenue: string | null;
  estimatedProfit: string | null;
  currency: string | null;
}

export interface SupplierPerformanceInput {
  supplierId: string;
  supplierName: string;
  currency: string | null;
  codesImported: number;
  codesSold: number;
  codesDelivered: number;
  codesInvalid: number;
  replacementCount: number;
  /** Sum of known costs across the supplier's codes, or null if none known. */
  estimatedCost: number | null;
  /** Best-effort revenue attributed via assignments → order item unit price. */
  estimatedRevenue: number | null;
}

export function toSupplierPerformanceDto(
  input: SupplierPerformanceInput,
): SupplierPerformanceRowDto {
  const estimatedProfit =
    input.estimatedRevenue !== null && input.estimatedCost !== null
      ? money(input.estimatedRevenue - input.estimatedCost)
      : null;

  return {
    supplierId: input.supplierId,
    supplierName: input.supplierName,
    codesImported: input.codesImported,
    codesSold: input.codesSold,
    codesDelivered: input.codesDelivered,
    codesInvalid: input.codesInvalid,
    replacementCount: input.replacementCount,
    invalidRate: rate(input.codesInvalid, input.codesImported),
    estimatedCost: input.estimatedCost === null ? null : money(input.estimatedCost),
    estimatedRevenue:
      input.estimatedRevenue === null ? null : money(input.estimatedRevenue),
    estimatedProfit,
    currency: input.currency,
  };
}

/* -------------------------------- Delivery ------------------------------- */

export interface DeliveryChannelCountDto {
  channel: string;
  count: number;
}

export interface DeliveryReportDto {
  totalDeliveries: number;
  completed: number;
  pending: number;
  processing: number;
  failed: number;
  manualReview: number;
  cancelled: number;
  /** Deliveries whose channel is `manual`. */
  manualDeliveries: number;
  /** Total retries = Σ max(attempt_count − 1, 0) across deliveries. */
  retries: number;
  /** Mean attempt_count over all deliveries (2 dp). */
  averageAttempts: string;
  /** Mean completed_at − created_at over completed deliveries, in seconds. */
  averageDeliverySeconds: number | null;
  failedByChannel: DeliveryChannelCountDto[];
}

/* ------------------------------- Stock health ---------------------------- */

export interface StockHealthRowDto {
  productId: string;
  productName: string | null;
  available: number;
  lowStockThreshold: number;
  stockStatus: StockStatus;
}

export interface ExpiringProductDto {
  productId: string;
  productName: string | null;
  count: number;
  earliestExpiry: Date | null;
}

export interface StockHealthDto {
  products: StockHealthRowDto[];
  outOfStockCount: number;
  lowStockCount: number;
  belowThresholdCount: number;
  expiringWithinDays: number;
  expiringCodesCount: number;
  expiringProducts: ExpiringProductDto[];
}
