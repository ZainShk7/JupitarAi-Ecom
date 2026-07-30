import { z } from "zod";
import { CURRENCIES } from "@/lib/money";
import { PRODUCT_STATUSES } from "@/lib/product-status";

/**
 * Single shared schema for a product's editable fields — reused for
 * inline-edit validation, server action input, and CSV row parsing (import).
 * Derived fields (fees, margin, verdict...) are never part of this schema;
 * they're computed, never stored.
 */
export const productFieldsSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(500),
  category: z.string().trim().max(200).nullable(),
  sourceUrl: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().url().nullable(),
  ),
  costPriceAmount: z.number().int().min(0),
  costPriceCurrency: z.enum(CURRENCIES),
  deliveryDays: z.number().int().min(0).nullable(),
  targetPrice: z.number().int().min(0),
  competitorSoldCount: z.number().int().min(0).nullable(),
  status: z.enum(PRODUCT_STATUSES),
  notes: z.string().max(5000).nullable(),
});

export type ProductFields = z.infer<typeof productFieldsSchema>;

export const productFieldsPatchSchema = productFieldsSchema.partial();
export type ProductFieldsPatch = z.infer<typeof productFieldsPatchSchema>;

export const NEW_PRODUCT_DEFAULTS: ProductFields = {
  name: "Untitled product",
  category: null,
  sourceUrl: null,
  costPriceAmount: 0,
  costPriceCurrency: "GBP",
  deliveryDays: null,
  targetPrice: 0,
  competitorSoldCount: null,
  status: "researching",
  notes: null,
};
