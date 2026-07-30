import { eq } from "drizzle-orm";
import { db } from "@/db";
import { DEFAULT_FX_RATES, SETTINGS_ROW_ID, settings as settingsTable } from "@/db/schema";
import type { SettingsInput } from "@/lib/metrics";

export const FALLBACK_SETTINGS: SettingsInput = {
  ebayFeePercent: 12.8,
  ebayFeeFixedPence: 30,
  promotedAdPercent: 0,
  inboundShippingPence: 0,
  minMarginPercent: 20,
  maxDeliveryDays: 20,
  vatPercent: 0,
  fxRates: DEFAULT_FX_RATES,
};

export async function getSettings(): Promise<SettingsInput> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.id, SETTINGS_ROW_ID)).limit(1);
  const row = rows[0];
  if (!row) return FALLBACK_SETTINGS;
  return {
    ebayFeePercent: row.ebayFeePercent,
    ebayFeeFixedPence: row.ebayFeeFixedPence,
    promotedAdPercent: row.promotedAdPercent,
    inboundShippingPence: row.inboundShippingPence,
    minMarginPercent: row.minMarginPercent,
    maxDeliveryDays: row.maxDeliveryDays,
    vatPercent: row.vatPercent,
    fxRates: row.fxRates,
  };
}
