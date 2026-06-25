CREATE TABLE "digital_product_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"fulfillment_type" text DEFAULT 'license_key' NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"auto_delivery_enabled" boolean DEFAULT true NOT NULL,
	"delivery_mode" text DEFAULT 'automatic' NOT NULL,
	"code_pool_strategy" text DEFAULT 'fifo' NOT NULL,
	"reserve_on_statuses" text[] DEFAULT ARRAY['processing','on-hold','completed']::text[] NOT NULL,
	"deliver_on_statuses" text[] DEFAULT ARRAY['processing','completed']::text[] NOT NULL,
	"allow_manual_assignment" boolean DEFAULT true NOT NULL,
	"allow_replacement" boolean DEFAULT true NOT NULL,
	"low_stock_threshold" integer DEFAULT 5 NOT NULL,
	"max_codes_per_order_item" integer DEFAULT 50 NOT NULL,
	"instructions_template" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "digital_product_settings" ADD CONSTRAINT "digital_product_settings_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_product_settings" ADD CONSTRAINT "digital_product_settings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "digital_product_settings_store_product_unique" ON "digital_product_settings" USING btree ("store_id","product_id");--> statement-breakpoint
CREATE INDEX "digital_product_settings_store_enabled_idx" ON "digital_product_settings" USING btree ("store_id","is_enabled");--> statement-breakpoint
CREATE INDEX "digital_product_settings_store_fulfillment_type_idx" ON "digital_product_settings" USING btree ("store_id","fulfillment_type");--> statement-breakpoint
CREATE INDEX "digital_product_settings_product_idx" ON "digital_product_settings" USING btree ("product_id");