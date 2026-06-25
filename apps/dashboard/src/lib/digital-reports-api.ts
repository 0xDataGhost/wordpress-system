/**
 * Digital reports API client (Phase 21 — Digital Reports & Profit Analytics).
 *
 * Calls the backend digital-reports module (mounted at /api/v1/digital-reports)
 * through the shared HTTP client. Every endpoint is read-only and requires
 * `digital_reports.view`:
 *   getSummary    → GET /digital-reports/summary
 *   getInventory  → GET /digital-reports/inventory
 *   getProfit     → GET /digital-reports/profit
 *   getSuppliers  → GET /digital-reports/suppliers
 *   getDelivery   → GET /digital-reports/delivery
 *   getStock      → GET /digital-reports/low-stock
 *
 * SECURITY: these are aggregate analytics only — no endpoint returns a raw code.
 */

import { apiRequest } from "./http";

export type StockStatus = "out_of_stock" | "low" | "healthy";

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  productId?: string;
  supplierId?: string;
  currency?: string;
}

export interface DigitalSummary {
  totalDigitalProducts: number;
  availableCodes: number;
  soldCodes: number;
  deliveredCodes: number;
  lowStockProducts: number;
  failedDeliveries: number;
  replacementRate: number;
  digitalOrders: number;
  deliveredOrders: number;
  revenue: string;
  purchaseCost: string | null;
  grossProfit: string | null;
  profitPercent: number | null;
  currency: string;
}

export interface InventoryReportRow {
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

export interface ProfitReportRow {
  productId: string;
  productName: string | null;
  unitsSold: number;
  revenue: string;
  purchaseCost: string | null;
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

export interface ProfitReportTotals {
  unitsSold: number;
  revenue: string;
  purchaseCost: string | null;
  grossProfit: string | null;
  grossMargin: number | null;
  refundCount: number;
  replacementCount: number;
}

export interface ProfitReport {
  items: ProfitReportRow[];
  totals: ProfitReportTotals;
  currency: string;
}

export interface SupplierPerformanceRow {
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

export interface DeliveryChannelCount {
  channel: string;
  count: number;
}

export interface DeliveryReport {
  totalDeliveries: number;
  completed: number;
  pending: number;
  processing: number;
  failed: number;
  manualReview: number;
  cancelled: number;
  manualDeliveries: number;
  retries: number;
  averageAttempts: string;
  averageDeliverySeconds: number | null;
  failedByChannel: DeliveryChannelCount[];
}

export interface StockHealthRow {
  productId: string;
  productName: string | null;
  available: number;
  lowStockThreshold: number;
  stockStatus: StockStatus;
}

export interface ExpiringProduct {
  productId: string;
  productName: string | null;
  count: number;
  earliestExpiry: string | null;
}

export interface StockHealth {
  products: StockHealthRow[];
  outOfStockCount: number;
  lowStockCount: number;
  belowThresholdCount: number;
  expiringWithinDays: number;
  expiringCodesCount: number;
  expiringProducts: ExpiringProduct[];
}

function toQuery(filters: ReportFilters): Record<string, string | undefined> {
  return {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    productId: filters.productId,
    supplierId: filters.supplierId,
    currency: filters.currency,
  };
}

export async function getSummary(
  filters: ReportFilters = {},
): Promise<DigitalSummary> {
  return apiRequest<DigitalSummary>("/digital-reports/summary", {
    method: "GET",
    query: toQuery(filters),
  });
}

export async function getInventory(
  filters: ReportFilters = {},
): Promise<{ items: InventoryReportRow[] }> {
  return apiRequest<{ items: InventoryReportRow[] }>(
    "/digital-reports/inventory",
    { method: "GET", query: toQuery(filters) },
  );
}

export async function getProfit(
  filters: ReportFilters = {},
): Promise<ProfitReport> {
  return apiRequest<ProfitReport>("/digital-reports/profit", {
    method: "GET",
    query: toQuery(filters),
  });
}

export async function getSuppliers(
  filters: ReportFilters = {},
): Promise<{ items: SupplierPerformanceRow[] }> {
  return apiRequest<{ items: SupplierPerformanceRow[] }>(
    "/digital-reports/suppliers",
    { method: "GET", query: toQuery(filters) },
  );
}

export async function getDelivery(
  filters: ReportFilters = {},
): Promise<DeliveryReport> {
  return apiRequest<DeliveryReport>("/digital-reports/delivery", {
    method: "GET",
    query: toQuery(filters),
  });
}

export async function getStock(
  filters: Pick<ReportFilters, "productId" | "supplierId"> = {},
): Promise<StockHealth> {
  return apiRequest<StockHealth>("/digital-reports/low-stock", {
    method: "GET",
    query: { productId: filters.productId, supplierId: filters.supplierId },
  });
}

/** Arabic label + tone for a stock status. */
export function resolveStockStatus(status: StockStatus): {
  label: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
} {
  switch (status) {
    case "out_of_stock":
      return { label: "نفد المخزون", tone: "danger" };
    case "low":
      return { label: "منخفض", tone: "warning" };
    default:
      return { label: "جيد", tone: "success" };
  }
}

/** Arabic label for a delivery channel. */
export function resolveDeliveryChannel(channel: string): string {
  const map: Record<string, string> = {
    dashboard: "لوحة التحكم",
    email: "البريد",
    whatsapp: "واتساب",
    woocommerce_note: "ملاحظة ووكومرس",
    manual: "يدوي",
  };
  return map[channel] ?? channel;
}
