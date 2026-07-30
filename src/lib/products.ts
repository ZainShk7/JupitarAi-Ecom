import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  DEFAULT_FX_RATES,
  SETTINGS_ROW_ID,
  products,
  settings as settingsTable,
  type ProductStatus,
} from "@/db/schema";
import { computeMetrics, type ProductMetrics, type SettingsInput } from "@/lib/metrics";
import type { CurrencyCode } from "@/lib/money";

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

const FALLBACK_SETTINGS: SettingsInput = {
  ebayFeePercent: 12.8,
  ebayFeeFixedPence: 30,
  promotedAdPercent: 0,
  inboundShippingPence: 0,
  minMarginPercent: 20,
  maxDeliveryDays: 20,
  vatPercent: 0,
  fxRates: DEFAULT_FX_RATES,
};

export async function getPipelineData(): Promise<PipelineData> {
  const [productRows, settingsRows] = await Promise.all([
    db.select().from(products),
    db.select().from(settingsTable).where(eq(settingsTable.id, SETTINGS_ROW_ID)).limit(1),
  ]);

  const settingsRow = settingsRows[0];
  const settings: SettingsInput = settingsRow
    ? {
        ebayFeePercent: settingsRow.ebayFeePercent,
        ebayFeeFixedPence: settingsRow.ebayFeeFixedPence,
        promotedAdPercent: settingsRow.promotedAdPercent,
        inboundShippingPence: settingsRow.inboundShippingPence,
        minMarginPercent: settingsRow.minMarginPercent,
        maxDeliveryDays: settingsRow.maxDeliveryDays,
        vatPercent: settingsRow.vatPercent,
        fxRates: settingsRow.fxRates,
      }
    : FALLBACK_SETTINGS;

  const rows: ProductRow[] = productRows.map((product) => {
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
  });

  const categories = Array.from(
    new Set(rows.map((row) => row.category).filter((category): category is string => Boolean(category))),
  ).sort((a, b) => a.localeCompare(b));

  return { rows, categories, settings };
}
