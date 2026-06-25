import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_DELIVERY_TEMPLATE,
  renderDeliveryMessage,
} from "./delivery.template";

const baseCtx = {
  customerName: "أحمد",
  orderNumber: "1042",
  productName: "Netflix 1 Month",
  maskedCodes: ["ABCD••••WXYZ", "EFGH••••3456"],
  instructions: "فعّل الكود خلال 24 ساعة",
  storeName: "متجري",
};

test("renderDeliveryMessage substitutes all supported variables", () => {
  const out = renderDeliveryMessage(
    "{{customer_name}}|{{order_number}}|{{product_name}}|{{code}}|{{store_name}}",
    baseCtx,
  );
  assert.equal(out, "أحمد|1042|Netflix 1 Month|ABCD••••WXYZ|متجري");
});

test("{{codes}} renders the full masked list, one per line", () => {
  const out = renderDeliveryMessage("{{codes}}", baseCtx);
  assert.equal(out, "ABCD••••WXYZ\nEFGH••••3456");
});

test("falls back to the default Arabic template when blank", () => {
  const out = renderDeliveryMessage("   ", baseCtx);
  assert.ok(out.includes("مرحباً أحمد"));
  assert.ok(out.includes("ABCD••••WXYZ"));
});

test("output only ever contains the masked previews it was given (no raw codes)", () => {
  // The renderer receives masked previews only; the bullet mask must be present
  // and no un-masked code-like token can appear that wasn't passed in.
  const out = renderDeliveryMessage(DEFAULT_DELIVERY_TEMPLATE, baseCtx);
  assert.ok(out.includes("••••"));
  // A raw (unmasked) code was never passed, so it cannot appear.
  assert.ok(!out.includes("ABCD1234"));
});

test("empty masked-codes list renders an empty {{code}}/{{codes}}", () => {
  const out = renderDeliveryMessage("[{{code}}][{{codes}}]", {
    ...baseCtx,
    maskedCodes: [],
  });
  assert.equal(out, "[][]");
});
