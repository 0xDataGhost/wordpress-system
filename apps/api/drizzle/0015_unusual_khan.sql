CREATE TABLE "digital_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"channel" text DEFAULT 'dashboard' NOT NULL,
	"recipient_email" text,
	"recipient_phone" text,
	"subject" text,
	"message_preview" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failed_reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"delivery_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"status" text NOT NULL,
	"provider" text,
	"provider_message_id" text,
	"error_code" text,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "digital_deliveries" ADD CONSTRAINT "digital_deliveries_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_deliveries" ADD CONSTRAINT "digital_deliveries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_deliveries" ADD CONSTRAINT "digital_deliveries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_deliveries" ADD CONSTRAINT "digital_deliveries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_delivery_id_digital_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."digital_deliveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "digital_deliveries_store_order_idx" ON "digital_deliveries" USING btree ("store_id","order_id");--> statement-breakpoint
CREATE INDEX "digital_deliveries_store_status_idx" ON "digital_deliveries" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "digital_deliveries_store_created_idx" ON "digital_deliveries" USING btree ("store_id","created_at","id");--> statement-breakpoint
CREATE INDEX "delivery_attempts_store_delivery_idx" ON "delivery_attempts" USING btree ("store_id","delivery_id","created_at","id");--> statement-breakpoint
CREATE INDEX "delivery_attempts_store_order_idx" ON "delivery_attempts" USING btree ("store_id","order_id");--> statement-breakpoint
CREATE INDEX "delivery_attempts_store_status_idx" ON "delivery_attempts" USING btree ("store_id","status");