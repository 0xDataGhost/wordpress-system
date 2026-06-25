import assert from "node:assert/strict";
import { test } from "node:test";
import { runChannel, type ChannelContext } from "./delivery.channels";

const ctx: ChannelContext = {
  storeId: "11111111-1111-1111-1111-111111111111",
  orderId: "22222222-2222-2222-2222-222222222222",
  wpOrderId: null,
  orderNumber: "1042",
  assignmentCount: 2,
};

test("dashboard channel reports sent (codes become staff-available)", async () => {
  const result = await runChannel("dashboard", ctx);
  assert.equal(result.status, "sent");
  assert.equal(result.provider, "dashboard");
});

test("email channel is a skipped placeholder", async () => {
  const result = await runChannel("email", ctx);
  assert.equal(result.status, "skipped");
  assert.equal(result.errorCode, "EMAIL_NOT_CONFIGURED");
});

test("whatsapp channel is a skipped placeholder", async () => {
  const result = await runChannel("whatsapp", ctx);
  assert.equal(result.status, "skipped");
  assert.equal(result.errorCode, "WHATSAPP_NOT_CONFIGURED");
});

test("woocommerce_note skips when the order is not linked to WooCommerce", async () => {
  // wpOrderId null short-circuits before any DB/connection lookup.
  const result = await runChannel("woocommerce_note", { ...ctx, wpOrderId: null });
  assert.equal(result.status, "skipped");
  assert.equal(result.errorCode, "NOT_LINKED");
});
