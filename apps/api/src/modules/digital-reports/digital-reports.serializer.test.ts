import assert from "node:assert/strict";
import { test } from "node:test";
import {
  toProfitRowDto,
  toProfitTotalsDto,
  toSupplierPerformanceDto,
  type ProfitRowInput,
} from "./digital-reports.serializer";

const baseRow: ProfitRowInput = {
  productId: "11111111-1111-1111-1111-111111111111",
  productName: "Netflix 1 Month",
  unitsSold: 10,
  revenue: 200,
  knownCost: 80,
  consumedCodes: 10,
  codesWithUnknownCost: 0,
  refundCount: 1,
  replacementCount: 2,
};

test("toProfitRowDto: full cost known → profit, margin, averages computed", () => {
  const dto = toProfitRowDto(baseRow);
  assert.equal(dto.revenue, "200.00");
  assert.equal(dto.purchaseCost, "80.00");
  assert.equal(dto.costComplete, true);
  assert.equal(dto.grossProfit, "120.00");
  assert.equal(dto.grossMargin, 60);
  assert.equal(dto.averageCost, "8.00");
  assert.equal(dto.averageSellingPrice, "20.00");
  assert.equal(dto.refundCount, 1);
  assert.equal(dto.replacementCount, 2);
});

test("toProfitRowDto: any unknown-cost code → profit null, cost incomplete", () => {
  const dto = toProfitRowDto({
    ...baseRow,
    consumedCodes: 10,
    codesWithUnknownCost: 3,
    knownCost: 56, // 7 codes × 8
  });
  assert.equal(dto.costComplete, false);
  assert.equal(dto.grossProfit, null);
  assert.equal(dto.grossMargin, null);
  // purchaseCost still reports the KNOWN portion (7 codes had a cost).
  assert.equal(dto.purchaseCost, "56.00");
  assert.equal(dto.averageCost, "8.00");
});

test("toProfitRowDto: no consumed codes → cost unknown, profit null", () => {
  const dto = toProfitRowDto({
    ...baseRow,
    consumedCodes: 0,
    codesWithUnknownCost: 0,
    knownCost: 0,
  });
  assert.equal(dto.purchaseCost, null);
  assert.equal(dto.costComplete, false);
  assert.equal(dto.grossProfit, null);
  assert.equal(dto.averageCost, null);
});

test("toProfitTotalsDto: aggregates and only reports profit when all rows complete", () => {
  const complete = toProfitRowDto(baseRow);
  const incomplete = toProfitRowDto({
    ...baseRow,
    productId: "22222222-2222-2222-2222-222222222222",
    revenue: 100,
    codesWithUnknownCost: 1,
  });

  const allComplete = toProfitTotalsDto([complete]);
  assert.equal(allComplete.revenue, "200.00");
  assert.equal(allComplete.purchaseCost, "80.00");
  assert.equal(allComplete.grossProfit, "120.00");
  assert.equal(allComplete.grossMargin, 60);

  const mixed = toProfitTotalsDto([complete, incomplete]);
  assert.equal(mixed.revenue, "300.00");
  assert.equal(mixed.purchaseCost, null);
  assert.equal(mixed.grossProfit, null);
  assert.equal(mixed.grossMargin, null);
  assert.equal(mixed.refundCount, 2);
  assert.equal(mixed.replacementCount, 4);
});

test("toProfitTotalsDto: empty input → zeros, unknown cost", () => {
  const totals = toProfitTotalsDto([]);
  assert.equal(totals.revenue, "0.00");
  assert.equal(totals.purchaseCost, null);
  assert.equal(totals.grossProfit, null);
});

test("toSupplierPerformanceDto: invalid rate + profit only when both sides known", () => {
  const dto = toSupplierPerformanceDto({
    supplierId: "ssssssss-ssss-ssss-ssss-ssssssssssss",
    supplierName: "Acme Codes",
    currency: "USD",
    codesImported: 100,
    codesSold: 60,
    codesDelivered: 50,
    codesInvalid: 4,
    replacementCount: 3,
    estimatedCost: 250,
    estimatedRevenue: 600,
  });
  assert.equal(dto.invalidRate, 0.04);
  assert.equal(dto.estimatedCost, "250.00");
  assert.equal(dto.estimatedRevenue, "600.00");
  assert.equal(dto.estimatedProfit, "350.00");
  assert.equal(dto.currency, "USD");
});

test("toSupplierPerformanceDto: unknown revenue/cost → profit null, rate guards zero", () => {
  const dto = toSupplierPerformanceDto({
    supplierId: "ssssssss-ssss-ssss-ssss-ssssssssssss",
    supplierName: "Acme",
    currency: null,
    codesImported: 0,
    codesSold: 0,
    codesDelivered: 0,
    codesInvalid: 0,
    replacementCount: 0,
    estimatedCost: null,
    estimatedRevenue: null,
  });
  assert.equal(dto.invalidRate, 0);
  assert.equal(dto.estimatedCost, null);
  assert.equal(dto.estimatedRevenue, null);
  assert.equal(dto.estimatedProfit, null);
});
