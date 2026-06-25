import type {
  CodePoolStrategy,
  DeliveryMode,
  FulfillmentType,
} from "@/lib/digital-products-api";

/**
 * Arabic option labels for the Phase 15 digital product settings form and the
 * read-only details summary. Status labels reuse the orders module's
 * ORDER_STATUS_OPTIONS so WooCommerce statuses read consistently across the app.
 */

export const FULFILLMENT_TYPE_LABELS: Record<FulfillmentType, string> = {
  license_key: "مفتاح تفعيل",
  subscription_code: "كود اشتراك",
  gift_card_code: "كود بطاقة رقمية",
};

export const DELIVERY_MODE_LABELS: Record<DeliveryMode, string> = {
  automatic: "تلقائي",
  manual: "يدوي",
  review_first: "مراجعة قبل الإرسال",
};

export const CODE_POOL_STRATEGY_LABELS: Record<CodePoolStrategy, string> = {
  fifo: "الأقدم أولاً",
  lifo: "الأحدث أولاً",
  earliest_expiry: "الأقرب انتهاءً أولاً",
  random: "عشوائي",
};

export const FULFILLMENT_TYPE_OPTIONS: { value: FulfillmentType; label: string }[] =
  [
    { value: "license_key", label: FULFILLMENT_TYPE_LABELS.license_key },
    {
      value: "subscription_code",
      label: FULFILLMENT_TYPE_LABELS.subscription_code,
    },
    { value: "gift_card_code", label: FULFILLMENT_TYPE_LABELS.gift_card_code },
  ];

export const DELIVERY_MODE_OPTIONS: { value: DeliveryMode; label: string }[] = [
  { value: "automatic", label: DELIVERY_MODE_LABELS.automatic },
  { value: "manual", label: DELIVERY_MODE_LABELS.manual },
  { value: "review_first", label: DELIVERY_MODE_LABELS.review_first },
];

export const CODE_POOL_STRATEGY_OPTIONS: {
  value: CodePoolStrategy;
  label: string;
}[] = [
  { value: "fifo", label: CODE_POOL_STRATEGY_LABELS.fifo },
  { value: "lifo", label: CODE_POOL_STRATEGY_LABELS.lifo },
  { value: "earliest_expiry", label: CODE_POOL_STRATEGY_LABELS.earliest_expiry },
  { value: "random", label: CODE_POOL_STRATEGY_LABELS.random },
];
