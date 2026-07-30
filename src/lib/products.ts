import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products, type ProductStatus } from "@/db/schema";
import { computeMetrics, type ProductMetrics, type SettingsInput } from "@/lib/metrics";
import type { CurrencyCode } from "@/lib/money";
import { getSettings } from "@/lib/settings";

export interface ProductRow {
  id: string;
  name: string;
  category: string | null;
  sourceUrl: string | null;
  costPriceAmount: number;
  costPriceCurrency: CurrencyCode;
  deliveryDays: number | null;
  targetPrice: number;
  competitorSoldCount: number | null;
  status: ProductStatus;
  notes: string | null;
  metrics: ProductMetrics;
}

export interface PipelineData {
  rows: ProductRow[];
  categories: string[];
  settings: SettingsInput;
}

function toProductRow(
  product: {
    id: string;
    name: string;
    category: string | null;
    sourceUrl: string | null;
    costPriceAmount: number;
    costPriceCurrency: string;
    deliveryDays: number | null;
    targetPrice: number;
    competitorSoldCount: number | null;
    status: ProductStatus;
    notes: string | null;
  },
  settings: SettingsInput,
): ProductRow {
  const costPriceCurrency = product.costPriceCurrency as CurrencyCode;
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    sourceUrl: product.sourceUrl,
    costPriceAmount: product.costPriceAmount,
    costPriceCurrency,
    deliveryDays: product.deliveryDays,
    targetPrice: product.targetPrice,
    competitorSoldCount: product.competitorSoldCount,
    status: product.status,
    notes: product.notes,
    metrics: computeMetrics(
      {
        costPriceAmount: product.costPriceAmount,
        costPriceCurrency,
        targetPrice: product.targetPrice,
        deliveryDays: product.deliveryDays,
        competitorSoldCount: product.competitorSoldCount,
      },
      settings,
    ),
  };
}

export async function getPipelineData(): Promise<PipelineData> {
  const [productRows, settings] = await Promise.all([db.select().from(products), getSettings()]);

  const rows: ProductRow[] = productRows.map((product) => toProductRow(product, settings));

  const categories = Array.from(
    new Set(rows.map((row) => row.category).filter((category): category is string => Boolean(category))),
  ).sort((a, b) => a.localeCompare(b));

  return { rows, categories, settings };
}

export async function getProductById(id: string): Promise<ProductRow | null> {
  const [productRow, settings] = await Promise.all([
    db.select().from(products).where(eq(products.id, id)).limit(1),
    getSettings(),
  ]);
  const product = productRow[0];
  if (!product) return null;
  return toProductRow(product, settings);
}
