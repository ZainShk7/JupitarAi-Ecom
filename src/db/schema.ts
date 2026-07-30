import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { CURRENCIES, type CurrencyCode } from "@/lib/money";

export const PRODUCT_STATUSES = [
  "researching",
  "shortlisted",
  "listed",
  "winner",
  "rejected",
] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category"),
  sourceUrl: text("source_url"),
  // Landed unit cost, in the currency it was actually quoted in — never
  // converted before storage. Conversion to GBP happens in lib/metrics.ts.
  costPriceAmount: integer("cost_price_amount").notNull().default(0),
  costPriceCurrency: text("cost_price_currency", { enum: CURRENCIES })
    .notNull()
    .default("GBP"),
  deliveryDays: integer("delivery_days"),
  targetPrice: integer("target_price").notNull().default(0), // GBP pence
  competitorSoldCount: integer("competitor_sold_count"),
  status: text("status", { enum: PRODUCT_STATUSES }).notNull().default("researching"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

// Single-row table — always read/written at id "default". Every calculation
// in lib/metrics.ts takes this row as an input; nothing here is derived.
export const settings = sqliteTable("settings", {
  id: text("id").primaryKey(),
  ebayFeePercent: real("ebay_fee_percent").notNull().default(12.8),
  ebayFeeFixedPence: integer("ebay_fee_fixed_pence").notNull().default(30),
  promotedAdPercent: real("promoted_ad_percent").notNull().default(0),
  inboundShippingPence: integer("inbound_shipping_pence").notNull().default(0),
  minMarginPercent: real("min_margin_percent").notNull().default(20),
  maxDeliveryDays: integer("max_delivery_days").notNull().default(20),
  vatPercent: real("vat_percent").notNull().default(0), // manual field, never fetched
  fxRates: text("fx_rates", { mode: "json" })
    .notNull()
    .$type<Record<CurrencyCode, number>>(),
});

export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;

export const SETTINGS_ROW_ID = "default";

export const DEFAULT_FX_RATES: Record<CurrencyCode, number> = {
  GBP: 1,
  USD: 0.79,
  EUR: 0.85,
  PKR: 0.0029,
  AUD: 0.52,
};
