import { type CurrencyCode } from "@/lib/money";

/**
 * Every number a product row shows is derived here, on read, from stored
 * inputs + the live settings row. Nothing derived is ever persisted —
 * that's the whole reason this app exists instead of the old spreadsheet.
 */

export type Verdict = "strong" | "viable" | "marginal" | "kill";

export type FxRates = Record<CurrencyCode, number>;

export interface SettingsInput {
  ebayFeePercent: number;
  ebayFeeFixedPence: number;
  promotedAdPercent: number;
  inboundShippingPence: number;
  minMarginPercent: number;
  maxDeliveryDays: number;
  /** Manual field — the user enters their applicable VAT rate; never fetched or inferred. */
  vatPercent: number;
  /** GBP value of 1 major unit of the given currency. GBP itself is always 1. */
  fxRates: FxRates;
}

export interface ProductMetricsInput {
  costPriceAmount: number; // integer minor units, in costPriceCurrency
  costPriceCurrency: CurrencyCode;
  targetPrice: number; // integer GBP pence
  deliveryDays: number | null;
  competitorSoldCount: number | null;
}

export interface VerdictFactor {
  label: string;
  score: number; // 0-100, already weighted contribution excluded — this is the raw sub-score
  weight: number; // 0-1
  isPenalty?: boolean;
}

export interface ProductMetrics {
  costPriceGBP: number; // pence
  fees: number; // pence
  vatDue: number; // pence
  totalCost: number; // pence
  profit: number; // pence
  marginPercent: number | null;
  roiPercent: number | null;
  breakevenPrice: number | null; // GBP pence
  verdict: Verdict;
  verdictScore: number; // 0-100
  factors: VerdictFactor[];
}

const EPSILON = 1e-9;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function safeDivide(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(denominator) || Math.abs(denominator) < EPSILON) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

/** Convert a cost entered in any supported currency to integer GBP pence. */
export function convertToGBPPence(
  amountMinorUnits: number,
  currency: CurrencyCode,
  fxRates: FxRates,
): number {
  if (!Number.isFinite(amountMinorUnits) || amountMinorUnits <= 0) return 0;
  const rate = currency === "GBP" ? 1 : fxRates[currency];
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return Math.round(amountMinorUnits * rate);
}

/**
 * eBay final-value + Promoted Listings fees for a given GBP sale price.
 * Kept as its own function so the breakeven/reverse-price solvers can
 * re-run it exactly (same rounding) instead of approximating.
 */
export function calculateFees(targetPrice: number, settings: SettingsInput): number {
  if (!Number.isFinite(targetPrice) || targetPrice <= 0) return 0;
  const percentFee = Math.round(
    (targetPrice * (settings.ebayFeePercent + settings.promotedAdPercent)) / 100,
  );
  return percentFee + settings.ebayFeeFixedPence;
}

export function calculateVat(targetPrice: number, settings: SettingsInput): number {
  if (!Number.isFinite(targetPrice) || targetPrice <= 0) return 0;
  return Math.round((targetPrice * settings.vatPercent) / 100);
}

function calculateProfit(
  targetPrice: number,
  costPriceGBP: number,
  settings: SettingsInput,
): number {
  const fees = calculateFees(targetPrice, settings);
  const vatDue = calculateVat(targetPrice, settings);
  const totalCost = costPriceGBP + fees + settings.inboundShippingPence + vatDue;
  return targetPrice - totalCost;
}

/**
 * Smallest integer GBP-pence price at which profit >= 0.
 * Solved algebraically for the combined fee+VAT rate, then nudged to the
 * nearest penny that satisfies the *actual* per-line rounding — the
 * algebraic answer alone can be off by a penny either way.
 */
export function calculateBreakevenPrice(
  costPriceGBP: number,
  settings: SettingsInput,
): number | null {
  const combinedRate =
    (settings.ebayFeePercent + settings.promotedAdPercent + settings.vatPercent) / 100;
  if (combinedRate >= 1) return null; // fees alone consume the whole sale price

  const fixedCosts = costPriceGBP + settings.ebayFeeFixedPence + settings.inboundShippingPence;
  if (fixedCosts <= 0) return 0;

  let candidate = Math.ceil(fixedCosts / (1 - combinedRate));
  if (!Number.isFinite(candidate)) return null;

  const MAX_STEPS = 1000;
  for (let i = 0; i < MAX_STEPS; i++) {
    if (calculateProfit(candidate, costPriceGBP, settings) >= 0) {
      while (candidate > 0 && calculateProfit(candidate - 1, costPriceGBP, settings) >= 0) {
        candidate -= 1;
      }
      return candidate;
    }
    candidate += 1;
  }
  return null;
}

/** "What price do I need for X% margin?" — the detail page reverse calculator. */
export function calculatePriceForMargin(
  targetMarginPercent: number,
  costPriceGBP: number,
  settings: SettingsInput,
): number | null {
  const combinedRate =
    (settings.ebayFeePercent + settings.promotedAdPercent + settings.vatPercent) / 100;
  const denominator = 1 - combinedRate - targetMarginPercent / 100;
  if (denominator <= EPSILON) return null; // margin unreachable at any price

  const fixedCosts = costPriceGBP + settings.ebayFeeFixedPence + settings.inboundShippingPence;
  const price = fixedCosts / denominator;
  return Number.isFinite(price) && price > 0 ? Math.round(price) : null;
}

/**
 * Verdict scoring weights. Margin is weighted heaviest because it's the
 * bar the user set explicitly (`minMarginPercent`); ROI and demand are
 * secondary signals; delivery is a penalty subtracted at the end, not a
 * positive contributor. Tune these here — nowhere else.
 */
export const VERDICT_WEIGHTS = {
  margin: 0.45,
  roi: 0.25,
  demand: 0.2,
  delivery: 0.1,
} as const;

const VERDICT_THRESHOLDS = {
  strong: 75,
  viable: 55,
  marginal: 35,
};

/** 0-100: 50 sits exactly at the user's margin bar; +/-2 points per % away from it. */
function scoreMargin(marginPercent: number | null, minMarginPercent: number): number {
  if (marginPercent == null) return 0;
  return clamp(50 + (marginPercent - minMarginPercent) * 2, 0, 100);
}

/** 0-100, linear, capped at 150% ROI. No user-facing ROI threshold exists, so this scale is fixed here. */
function scoreRoi(roiPercent: number | null): number {
  if (roiPercent == null) return 0;
  return clamp((roiPercent / 150) * 100, 0, 100);
}

/** 0-100, log scale so 10 vs 100 vs 1000 units sold are meaningfully different, not linear-crushed. */
function scoreDemand(competitorSoldCount: number | null): number {
  const sold = Math.max(competitorSoldCount ?? 0, 0);
  return clamp((Math.log10(sold + 1) / Math.log10(1000)) * 100, 0, 100);
}

/** 0-100 penalty (not a score) — 0 until maxDeliveryDays, then 5pts per day over. */
function penaltyDelivery(deliveryDays: number | null, maxDeliveryDays: number): number {
  if (deliveryDays == null) return 0;
  return clamp((deliveryDays - maxDeliveryDays) * 5, 0, 100);
}

function tierFromScore(score: number): Verdict {
  if (score >= VERDICT_THRESHOLDS.strong) return "strong";
  if (score >= VERDICT_THRESHOLDS.viable) return "viable";
  if (score >= VERDICT_THRESHOLDS.marginal) return "marginal";
  return "kill";
}

export function computeMetrics(
  product: ProductMetricsInput,
  settings: SettingsInput,
): ProductMetrics {
  const costPriceGBP = convertToGBPPence(
    product.costPriceAmount,
    product.costPriceCurrency,
    settings.fxRates,
  );
  const targetPrice = Number.isFinite(product.targetPrice) ? Math.max(product.targetPrice, 0) : 0;

  const fees = calculateFees(targetPrice, settings);
  const vatDue = calculateVat(targetPrice, settings);
  const totalCost = costPriceGBP + fees + settings.inboundShippingPence + vatDue;
  const profit = targetPrice - totalCost;

  const marginPercent = safeDivide(profit, targetPrice);
  const roiPercent = safeDivide(profit, costPriceGBP);
  const marginPercentScaled = marginPercent == null ? null : marginPercent * 100;
  const roiPercentScaled = roiPercent == null ? null : roiPercent * 100;

  const breakevenPrice = calculateBreakevenPrice(costPriceGBP, settings);

  const marginScore = scoreMargin(marginPercentScaled, settings.minMarginPercent);
  const roiScore = scoreRoi(roiPercentScaled);
  const demandScore = scoreDemand(product.competitorSoldCount);
  const deliveryPenalty = penaltyDelivery(product.deliveryDays, settings.maxDeliveryDays);

  const rawScore =
    marginScore * VERDICT_WEIGHTS.margin +
    roiScore * VERDICT_WEIGHTS.roi +
    demandScore * VERDICT_WEIGHTS.demand -
    deliveryPenalty * VERDICT_WEIGHTS.delivery;
  const verdictScore = clamp(rawScore, 0, 100);

  let verdict = tierFromScore(verdictScore);
  // Margin is the bar the user explicitly set — never let a product that
  // misses it read as "strong" or "viable" purely on ROI/demand momentum.
  if (marginPercentScaled != null) {
    if (marginPercentScaled <= 0) {
      verdict = "kill";
    } else if (
      marginPercentScaled < settings.minMarginPercent &&
      (verdict === "strong" || verdict === "viable")
    ) {
      verdict = "marginal";
    }
  }

  return {
    costPriceGBP,
    fees,
    vatDue,
    totalCost,
    profit,
    marginPercent: marginPercentScaled,
    roiPercent: roiPercentScaled,
    breakevenPrice,
    verdict,
    verdictScore,
    factors: [
      { label: "Margin", score: marginScore, weight: VERDICT_WEIGHTS.margin },
      { label: "ROI", score: roiScore, weight: VERDICT_WEIGHTS.roi },
      { label: "Demand", score: demandScore, weight: VERDICT_WEIGHTS.demand },
      {
        label: "Delivery",
        score: deliveryPenalty,
        weight: VERDICT_WEIGHTS.delivery,
        isPenalty: true,
      },
    ],
  };
}
