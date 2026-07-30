CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"source_url" text,
	"cost_price_amount" integer DEFAULT 0 NOT NULL,
	"cost_price_currency" text DEFAULT 'GBP' NOT NULL,
	"delivery_days" integer,
	"target_price" integer DEFAULT 0 NOT NULL,
	"competitor_sold_count" integer,
	"status" text DEFAULT 'researching' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY NOT NULL,
	"ebay_fee_percent" real DEFAULT 12.8 NOT NULL,
	"ebay_fee_fixed_pence" integer DEFAULT 30 NOT NULL,
	"promoted_ad_percent" real DEFAULT 0 NOT NULL,
	"inbound_shipping_pence" integer DEFAULT 0 NOT NULL,
	"min_margin_percent" real DEFAULT 20 NOT NULL,
	"max_delivery_days" integer DEFAULT 20 NOT NULL,
	"vat_percent" real DEFAULT 0 NOT NULL,
	"fx_rates" jsonb NOT NULL
);
