/**
 * Delivery message templating (Phase 18, plan2 §18). Pure + side-effect free —
 * it NEVER logs its output.
 *
 * SECURITY: in Phase 18 the rendered message uses MASKED code previews, never
 * raw codes. Phase 18 channels deliver a "codes are ready" notice (and staff
 * reveal the real codes via the audited Phase 16 reveal endpoint); raw codes are
 * not transmitted to customers until the customer portal (Phase 22). So the
 * rendered message is safe to store as `message_preview`.
 */

/** Safe default Arabic template used when a product has no custom template. */
export const DEFAULT_DELIVERY_TEMPLATE = `مرحباً {{customer_name}}،
تم تجهيز طلبك رقم {{order_number}}.
الأكواد:
{{codes}}

{{instructions}}`;

export interface DeliveryTemplateContext {
  customerName: string;
  orderNumber: string;
  productName: string;
  /** MASKED code previews only (e.g. "ABCD••••WXYZ") — never raw codes. */
  maskedCodes: string[];
  instructions: string;
  storeName: string;
}

/**
 * Renders a delivery template by substituting the supported variables. `{{code}}`
 * uses the first masked preview, `{{codes}}` the full masked list. Because only
 * masked previews are passed in, the output can never contain a raw code.
 */
export function renderDeliveryMessage(
  template: string,
  ctx: DeliveryTemplateContext,
): string {
  const source = template.trim() === "" ? DEFAULT_DELIVERY_TEMPLATE : template;
  const codesBlock = ctx.maskedCodes.join("\n");
  const firstCode = ctx.maskedCodes[0] ?? "";
  return source
    .replaceAll("{{customer_name}}", ctx.customerName)
    .replaceAll("{{order_number}}", ctx.orderNumber)
    .replaceAll("{{product_name}}", ctx.productName)
    .replaceAll("{{code}}", firstCode)
    .replaceAll("{{codes}}", codesBlock)
    .replaceAll("{{instructions}}", ctx.instructions)
    .replaceAll("{{store_name}}", ctx.storeName);
}
