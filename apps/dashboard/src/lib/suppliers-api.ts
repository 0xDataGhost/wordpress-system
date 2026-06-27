/**
 * Suppliers API client (Phase 20 — Suppliers & Batch Cost Tracking).
 *
 * Calls the backend suppliers module (mounted at /api/v1/suppliers) through the
 * shared HTTP client:
 *   listSuppliers          → GET    /suppliers                         (digital_suppliers.view)
 *   getSupplier            → GET    /suppliers/:id                     (digital_suppliers.view)
 *   createSupplier         → POST   /suppliers                         (digital_suppliers.create)
 *   updateSupplier         → PATCH  /suppliers/:id                     (digital_suppliers.edit)
 *   archiveSupplier        → DELETE /suppliers/:id                     (digital_suppliers.delete)
 *   listSupplierProducts   → GET    /suppliers/:id/products            (digital_suppliers.view)
 *   linkSupplierProduct    → POST   /suppliers/:id/products            (digital_suppliers.edit)
 *   updateSupplierProduct  → PATCH  /suppliers/:id/products/:mappingId (digital_suppliers.edit)
 *   unlinkSupplierProduct  → DELETE /suppliers/:id/products/:mappingId (digital_suppliers.edit)
 *   listSupplierBatches    → GET    /suppliers/:id/batches             (digital_suppliers.view)
 *
 * Suppliers hold no secrets — there is no masking concern here.
 */

import { apiRequest } from "./http";
import type { Batch } from "./digital-inventory-api";

export const SUPPLIER_STATUSES = ["active", "paused", "archived"] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  country: string | null;
  currency: string | null;
  notes: string | null;
  status: string;
  isPreferred: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierMetrics {
  totalCodes: number;
  available: number;
  sold: number;
  delivered: number;
  invalid: number;
  voided: number;
  refunded: number;
  batchesCount: number;
  productsCount: number;
  /** Exact-decimal estimated purchase cost, or null when unknown. */
  estimatedCost: string | null;
  currency: string | null;
  invalidRate: number;
}

export interface SupplierWithMetrics extends Supplier {
  metrics: SupplierMetrics;
}

export interface SupplierListItem extends Supplier {
  productsCount: number;
  batchesCount: number;
  lastBatchAt: string | null;
}

export interface SupplierProduct {
  id: string;
  supplierId: string;
  productId: string;
  supplierSku: string | null;
  costPrice: string | null;
  currency: string | null;
  minOrderQuantity: number | null;
  leadTimeDays: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SupplierListResult {
  items: SupplierListItem[];
  pagination: Pagination;
}

export interface ListSuppliersQuery {
  status?: SupplierStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface SupplierInput {
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  country?: string | null;
  currency?: string | null;
  notes?: string | null;
  status?: SupplierStatus;
  isPreferred?: boolean;
}

export interface SupplierProductInput {
  productId: string;
  supplierSku?: string | null;
  costPrice?: number;
  currency?: string | null;
  minOrderQuantity?: number;
  leadTimeDays?: number;
  notes?: string | null;
}

export async function listSuppliers(
  query: ListSuppliersQuery = {},
): Promise<SupplierListResult> {
  return apiRequest<SupplierListResult>("/suppliers", {
    method: "GET",
    query: {
      status: query.status,
      search: query.search,
      page: query.page,
      limit: query.limit,
    },
  });
}

export async function getSupplier(id: string): Promise<SupplierWithMetrics> {
  return apiRequest<SupplierWithMetrics>(`/suppliers/${id}`, { method: "GET" });
}

export async function createSupplier(body: SupplierInput): Promise<Supplier> {
  return apiRequest<Supplier>("/suppliers", { method: "POST", body });
}

export async function updateSupplier(
  id: string,
  body: Partial<SupplierInput>,
): Promise<Supplier> {
  return apiRequest<Supplier>(`/suppliers/${id}`, { method: "PATCH", body });
}

export async function archiveSupplier(id: string): Promise<Supplier> {
  return apiRequest<Supplier>(`/suppliers/${id}`, { method: "DELETE" });
}

export async function listSupplierProducts(
  supplierId: string,
): Promise<{ items: SupplierProduct[] }> {
  return apiRequest<{ items: SupplierProduct[] }>(
    `/suppliers/${supplierId}/products`,
    { method: "GET" },
  );
}

export async function linkSupplierProduct(
  supplierId: string,
  body: SupplierProductInput,
): Promise<SupplierProduct> {
  return apiRequest<SupplierProduct>(`/suppliers/${supplierId}/products`, {
    method: "POST",
    body,
  });
}

export async function updateSupplierProduct(
  supplierId: string,
  mappingId: string,
  body: Partial<Omit<SupplierProductInput, "productId">>,
): Promise<SupplierProduct> {
  return apiRequest<SupplierProduct>(
    `/suppliers/${supplierId}/products/${mappingId}`,
    { method: "PATCH", body },
  );
}

export async function unlinkSupplierProduct(
  supplierId: string,
  mappingId: string,
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(
    `/suppliers/${supplierId}/products/${mappingId}`,
    { method: "DELETE" },
  );
}

export async function listSupplierBatches(
  supplierId: string,
): Promise<{ items: Batch[] }> {
  return apiRequest<{ items: Batch[] }>(`/suppliers/${supplierId}/batches`, {
    method: "GET",
  });
}
