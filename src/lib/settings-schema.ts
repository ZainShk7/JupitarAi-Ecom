import { z } from "zod";
import { CURRENCIES } from "@/lib/money";

/** Every non-GBP currency needs a rate; GBP is always fixed at 1 in code, not stored as user input. */
const fxRatesSchema = z.object(
  Object.fromEntries(CURRENCIES.map((currency) => [currency, z.number().positive()])) as Record<
    (typeof CURRENCIES)[number],
    z.ZodNumber
  >,
);

export const settingsFieldsSchema = z.object({
  ebayFeePercent: z.number().min(0).max(100),
  ebayFeeFixedPence: z.number().int().min(0),
  promotedAdPercent: z.number().min(0).max(100),
  inboundShippingPence: z.number().int().min(0),
  minMarginPercent: z.number().min(0).max(100),
  maxDeliveryDays: z.number().int().min(0),
  vatPercent: z.number().min(0).max(100),
  fxRates: fxRatesSchema,
});

export type SettingsFields = z.infer<typeof settingsFieldsSchema>;

export const settingsFieldsPatchSchema = settingsFieldsSchema.partial();
export type SettingsFieldsPatch = z.infer<typeof settingsFieldsPatchSchema>;
