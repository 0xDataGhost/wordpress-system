import assert from "node:assert/strict";
import { test } from "node:test";
import {
  average,
  grossMargin,
  grossProfit,
  money,
  num,
  rate,
  stockStatus,
} from "./digital-reports.math";

test("num coerces nullish/non-finite to 0", () => {
  assert.equal(num(null), 0);
  assert.equal(num(undefined), 0);
  assert.equal(num("12.5"), 12.5);
  assert.equal(num("not-a-number"), 0);
  assert.equal(num(7), 7);
});

test("money formats to exactly two decimals", () => {
  assert.equal(money("10"), "10.00");
  assert.equal(money(2.5), "2.50");
  assert.equal(money(null), "0.00");
});

test("grossProfit returns null for unknown cost, else revenue - cost", () => {
  assert.equal(grossProfit(100, null), null);
  assert.equal(grossProfit(100, 40), 60);
  assert.equal(grossProfit(40, 100), -60);
});

test("grossMargin is profit/revenue percent (2 dp); null when unknown or no revenue", () => {
  assert.equal(grossMargin(100, 25), 25);
  assert.equal(grossMargin(3, 1), 33.33);
  assert.equal(grossMargin(100, null), null);
  assert.equal(grossMargin(0, 0), null);
  assert.equal(grossMargin(-5, 1), null);
});

test("rate is numerator/denominator (4 dp); 0 when denominator <= 0", () => {
  assert.equal(rate(1, 4), 0.25);
  assert.equal(rate(1, 3), 0.3333);
  assert.equal(rate(5, 0), 0);
  assert.equal(rate(0, 10), 0);
  assert.equal(rate(10, 10), 1);
});

test("average is total/count money string; 0.00 when count <= 0", () => {
  assert.equal(average(100, 4), "25.00");
  assert.equal(average(10, 3), "3.33");
  assert.equal(average(50, 0), "0.00");
});

test("stockStatus classifies out_of_stock / low / healthy", () => {
  assert.equal(stockStatus(0, 5), "out_of_stock");
  assert.equal(stockStatus(5, 5), "low");
  assert.equal(stockStatus(3, 5), "low");
  assert.equal(stockStatus(6, 5), "healthy");
});
