/**
 * All money in this app is stored and computed as integer minor units
 * (pence, cents, paisa...) — never floats. Format only at the render boundary.
 */

export const CURRENCIES = ["GBP", "USD", "EUR", "PKR", "AUD"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

const LOCALE_BY_CURRENCY: Record<CurrencyCode, string> = {
  GBP: "en-GB",
  USD: "en-US",
  EUR: "en-IE",
  PKR: "en-PK",
  AUD: "en-AU",
};

/** Major-unit amount (e.g. 3.78) -> integer minor units (378). */
export function toPence(amount: number): number {
  return Math.round(amount * 100);
}

/** Integer minor units (378) -> major-unit amount (3.78). */
export function fromPence(pence: number): number {
  return pence / 100;
}

/** Format integer GBP pence as a localized £ string, or "—" for missing/invalid input. */
export function formatGBP(pence: number | null | undefined): string {
  return formatMoney(pence, "GBP");
}

/** Same conversion as toPence/fromPence — named generically for non-GBP currencies. */
export const toMinorUnits = toPence;
export const fromMinorUnits = fromPence;

/** Format integer minor units in any supported currency, or "—" for missing/invalid input. */
export function formatMoney(
  minorUnits: number | null | undefined,
  currency: CurrencyCode,
): string {
  if (minorUnits == null || !Number.isFinite(minorUnits)) return "—";
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency], {
    style: "currency",
    currency,
  }).format(fromMinorUnits(minorUnits));
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}
