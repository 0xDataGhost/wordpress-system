CREATE TABLE "store_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"api_key_id" text,
	"api_key_hash" text,
	"api_key_prefix" text,
	"api_key_generated_at" timestamp with time zone,
	"site_url" text,
	"wp_version" text,
	"wc_version" text,
	"connector_version" text,
	"last_connected_at" timestamp with time zone,
	"last_health_check_at" timestamp with time zone,
	"last_health_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store_connections" ADD CONSTRAINT "store_connections_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "store_connections_store_unique" ON "store_connections" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "store_connections_api_key_id_unique" ON "store_connections" USING btree ("api_key_id");