import assert from "node:assert/strict";
import { test } from "node:test";
import type { CustomerRow } from "../../db/schema/customers";
import type { OrderItemRow } from "../../db/schema/order-items";
import type { OrderRow } from "../../db/schema/orders";
import {
  toCustomerSummaryDto,
  toOrderDetailsDto,
  toOrderDto,
  toOrderItemDto,
} from "./orders.serializer";

function makeOrder(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: "3f9a1c7b-2d4e-5f60-8a1b-2c3d4e5f6071",
    storeId: "11111111-1111-1111-1111-111111111111",
    wpOrderId: 1024,
    customerId: "22222222-2222-2222-2222-222222222222",
    orderNumber: "#1024",
    status: "completed",
    total: "349.50",
    currency: "SAR",
    paymentMethod: "cod",
    internalNotes: "اتصل بالعميل قبل الشحن",
    placedAt: new Date("2026-02-01T10:00:00.000Z"),
    lastSyncedAt: new Date("2026-02-02T10:00:00.000Z"),
    createdAt: new Date("2026-02-01T09:00:00.000Z"),
    updatedAt: new Date("2026-02-02T11:00:00.000Z"),
    ...overrides,
  };
}

function makeCustomer(overrides: Partial<CustomerRow> = {}): CustomerRow {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    storeId: "11111111-1111-1111-1111-111111111111",
    wpCustomerId: 77,
    name: "سارة أحمد",
    email: "sara@example.com",
    phone: "+966500000000",
    totalSpent: "1200.00",
    ordersCount: 4,
    lastOrderAt: new Date("2026-02-01T10:00:00.000Z"),
    lastSyncedAt: new Date("2026-02-02T10:00:00.000Z"),
    createdAt: new Date("2025-12-01T00:00:00.000Z"),
    updatedAt: new Date("2026-02-02T10:00:00.000Z"),
    ...overrides,
  };
}

function makeItem(overrides: Partial<OrderItemRow> = {}): OrderItemRow {
  return {
    id: "33333333-3333-3333-3333-333333333333",
    storeId: "11111111-1111-1111-1111-111111111111",
    orderId: "3f9a1c7b-2d4e-5f60-8a1b-2c3d4e5f6071",
    productId: "44444444-4444-4444-4444-444444444444",
    wpProductId: 555,
    name: "قميص قطني",
    sku: "SHIRT-1",
    quantity: 2,
    price: "174.75",
    total: "349.50",
    createdAt: new Date("2026-02-01T09:00:00.000Z"),
    ...overrides,
  };
}

test("toOrderDto maps every column and keeps money as a decimal string", () => {
  const dto = toOrderDto(makeOrder(), makeCustomer());
  assert.equal(dto.id, "3f9a1c7b-2d4e-5f60-8a1b-2c3d4e5f6071");
  assert.equal(dto.wpOrderId, 1024);
  assert.equal(dto.orderNumber, "#1024");
  assert.equal(dto.status, "completed");
  assert.equal(dto.total, "349.50");
  assert.equal(typeof dto.total, "string");
  assert.equal(dto.currency, "SAR");
  assert.equal(dto.paymentMethod, "cod");
  assert.equal(dto.internalNotes, "اتصل بالعميل قبل الشحن");
  assert.equal(dto.customer?.name, "سارة أحمد");
});

test("toOrderDto leaves customer null for guest orders", () => {
  const dto = toOrderDto(makeOrder({ customerId: null }), null);
  assert.equal(dto.customer, null);
  assert.equal(dto.customerId, null);
});

test("toCustomerSummaryDto returns null for a missing customer", () => {
  assert.equal(toCustomerSummaryDto(null), null);
  const summary = toCustomerSummaryDto(makeCustomer());
  assert.equal(summary?.email, "sara@example.com");
  assert.equal(summary?.ordersCount, 4);
  assert.equal(summary?.totalSpent, "1200.00");
});

test("toOrderItemDto maps line fields and keeps money as decimal strings", () => {
  const dto = toOrderItemDto(makeItem());
  assert.equal(dto.name, "قميص قطني");
  assert.equal(dto.sku, "SHIRT-1");
  assert.equal(dto.quantity, 2);
  assert.equal(dto.price, "174.75");
  assert.equal(dto.total, "349.50");
  assert.equal(dto.wpProductId, 555);
});

test("toOrderDetailsDto includes serialized items and customer", () => {
  const details = toOrderDetailsDto(makeOrder(), makeCustomer(), [
    makeItem(),
    makeItem({ id: "55555555-5555-5555-5555-555555555555", name: "حذاء" }),
  ]);
  assert.equal(details.items.length, 2);
  assert.equal(details.items[0].name, "قميص قطني");
  assert.equal(details.items[1].name, "حذاء");
  assert.equal(details.customer?.name, "سارة أحمد");
});
