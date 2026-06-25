CREATE TABLE "code_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"supplier_id" uuid,
	"batch_name" text,
	"source" text DEFAULT 'manual_import' NOT NULL,
	"import_file_name" text,
	"quantity_total" integer DEFAULT 0 NOT NULL,
	"quantity_available" integer DEFAULT 0 NOT NULL,
	"quantity_reserved" integer DEFAULT 0 NOT NULL,
	"quantity_sold" integer DEFAULT 0 NOT NULL,
	"quantity_delivered" integer DEFAULT 0 NOT NULL,
	"quantity_invalid" integer DEFAULT 0 NOT NULL,
	"cost_total" numeric(12, 2),
	"cost_per_code" numeric(12, 4),
	"currency" text,
	"expires_at" timestamp with time zone,
	"notes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digital_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"batch_id" uuid,
	"supplier_id" uuid,
	"code_cipher" text NOT NULL,
	"code_iv" text NOT NULL,
	"code_tag" text NOT NULL,
	"code_hash" text NOT NULL,
	"code_preview" text,
	"status" text DEFAULT 'available' NOT NULL,
	"reserved_until" timestamp with time zone,
	"assigned_order_id" uuid,
	"assigned_order_item_id" uuid,
	"assigned_customer_id" uuid,
	"sold_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"cost_price" numeric(12, 4),
	"currency" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "code_batches" ADD CONSTRAINT "code_batches_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_batches" ADD CONSTRAINT "code_batches_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_batches" ADD CONSTRAINT "code_batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_codes" ADD CONSTRAINT "digital_codes_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_codes" ADD CONSTRAINT "digital_codes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_codes" ADD CONSTRAINT "digital_codes_batch_id_code_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."code_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_codes" ADD CONSTRAINT "digital_codes_assigned_order_id_orders_id_fk" FOREIGN KEY ("assigned_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_codes" ADD CONSTRAINT "digital_codes_assigned_order_item_id_order_items_id_fk" FOREIGN KEY ("assigned_order_item_id") REFERENCES "public"."order_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_codes" ADD CONSTRAINT "digital_codes_assigned_customer_id_customers_id_fk" FOREIGN KEY ("assigned_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_codes" ADD CONSTRAINT "digital_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "code_batches_store_product_idx" ON "code_batches" USING btree ("store_id","product_id");--> statement-breakpoint
CREATE INDEX "code_batches_store_supplier_idx" ON "code_batches" USING btree ("store_id","supplier_id");--> statement-breakpoint
CREATE INDEX "code_batches_store_status_idx" ON "code_batches" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "code_batches_store_created_idx" ON "code_batches" USING btree ("store_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "digital_codes_store_product_hash_unique" ON "digital_codes" USING btree ("store_id","product_id","code_hash");--> statement-breakpoint
CREATE INDEX "digital_codes_store_product_status_idx" ON "digital_codes" USING btree ("store_id","product_id","status");--> statement-breakpoint
CREATE INDEX "digital_codes_store_batch_idx" ON "digital_codes" USING btree ("store_id","batch_id");--> statement-breakpoint
CREATE INDEX "digital_codes_store_supplier_idx" ON "digital_codes" USING btree ("store_id","supplier_id");--> statement-breakpoint
CREATE INDEX "digital_codes_store_order_idx" ON "digital_codes" USING btree ("store_id","assigned_order_id");--> statement-breakpoint
CREATE INDEX "digital_codes_store_customer_idx" ON "digital_codes" USING btree ("store_id","assigned_customer_id");--> statement-breakpoint
CREATE INDEX "digital_codes_store_expires_idx" ON "digital_codes" USING btree ("store_id","expires_at");--> statement-breakpoint
CREATE INDEX "digital_codes_store_created_idx" ON "digital_codes" USING btree ("store_id","created_at","id");