import type { Request, Response } from "express";
import { successResponse } from "../../lib/api-response";
import { getAuth } from "../../middleware/authenticate";
import {
  getDeliveryReport,
  getDigitalSummary,
  getInventoryReport,
  getProfitReport,
  getStockHealth,
  getSupplierPerformance,
} from "./digital-reports.service";
import type {
  ReportFilters,
  StockReportQuery,
} from "./digital-reports.schemas";

/**
 * Phase 21 digital report handlers. Every report is read-only and tenant-scoped
 * (storeId from the JWT); none returns raw codes. No audit is recorded for
 * viewing reports (per the phase brief: read-only, no audit for views).
 */

/** GET /digital-reports/summary (digital_reports.view). */
export async function summaryHandler(req: Request, res: Response): Promise<void> {
  const { storeId } = getAuth(req);
  const filters = req.query as unknown as ReportFilters;
  const data = await getDigitalSummary(storeId, filters);
  res.status(200).json(successResponse(data));
}

/** GET /digital-reports/inventory (digital_reports.view). */
export async function inventoryHandler(req: Request, res: Response): Promise<void> {
  const { storeId } = getAuth(req);
  const filters = req.query as unknown as ReportFilters;
  const items = await getInventoryReport(storeId, filters);
  res.status(200).json(successResponse({ items }));
}

/** GET /digital-reports/profit (and /sales alias) (digital_reports.view). */
export async function profitHandler(req: Request, res: Response): Promise<void> {
  const { storeId } = getAuth(req);
  const filters = req.query as unknown as ReportFilters;
  const result = await getProfitReport(storeId, filters);
  res.status(200).json(
    successResponse({
      items: result.rows,
      totals: result.totals,
      currency: result.currency,
    }),
  );
}

/** GET /digital-reports/suppliers (digital_reports.view). */
export async function suppliersHandler(req: Request, res: Response): Promise<void> {
  const { storeId } = getAuth(req);
  const filters = req.query as unknown as ReportFilters;
  const items = await getSupplierPerformance(storeId, filters);
  res.status(200).json(successResponse({ items }));
}

/** GET /digital-reports/delivery (digital_reports.view). */
export async function deliveryHandler(req: Request, res: Response): Promise<void> {
  const { storeId } = getAuth(req);
  const filters = req.query as unknown as ReportFilters;
  const data = await getDeliveryReport(storeId, filters);
  res.status(200).json(successResponse(data));
}

/** GET /digital-reports/low-stock (and /stock alias) (digital_reports.view). */
export async function stockHandler(req: Request, res: Response): Promise<void> {
  const { storeId } = getAuth(req);
  const query = req.query as unknown as StockReportQuery;
  const data = await getStockHealth(storeId, query);
  res.status(200).json(successResponse(data));
}
