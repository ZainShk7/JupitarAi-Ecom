import { describe, expect, it } from "vitest";
import {
  calculateBreakevenPrice,
  calculateFees,
  calculatePriceForMargin,
  calculateVat,
  computeMetrics,
  convertToGBPPence,
  type ProductMetricsInput,
  type SettingsInput,
} from "@/lib/metrics";

const baseSettings: SettingsInput = {
  ebayFeePercent: 12.8,
  ebayFeeFixedPence: 30,
  promotedAdPercent: 0,
  inboundShippingPence: 0,
  minMarginPercent: 20,
  maxDeliveryDays: 20,
  vatPercent: 0,
  fxRates: { GBP: 1, USD: 0.79, EUR: 0.85, PKR: 0.0029, AUD: 0.52 },
};

function settings(overrides: Partial<SettingsInput> = {}): SettingsInput {
  return { ...baseSettings, ...overrides };
}

function product(overrides: Partial<ProductMetricsInput> = {}): ProductMetricsInput {
  return {
    costPriceAmount: 0,
    costPriceCurrency: "GBP",
    targetPrice: 0,
    deliveryDays: null,
    competitorSoldCount: null,
    ...overrides,
  };
}

describe("computeMetrics — the spreadsheet example row", () => {
  // Mark Pen Pencil Holder: cost £2.10, target £3.78, 12-day delivery, 850 sold.
  const result = computeMetrics(
    product({ costPriceAmount: 210, targetPrice: 378, deliveryDays: 12, competitorSoldCount: 850 }),
    settings(),
  );

  it("computes fees, total cost, and profit in integer pence", () => {
    expect(result.fees).toBe(78); // round(378 * 12.8 / 100) + 30
    expect(result.vatDue).toBe(0);
    expect(result.totalCost).toBe(288);
    expect(result.profit).toBe(90);
  });

  it("computes margin and ROI as percentages", () => {
    expect(result.marginPercent).toBeCloseTo(23.8095, 3);
    expect(result.roiPercent).toBeCloseTo(42.8571, 3);
  });

  it("never lands exactly on the tier boundary by accident and produces a finite score", () => {
    expect(Number.isFinite(result.verdictScore)).toBe(true);
    expect(result.verdictScore).toBeGreaterThan(35);
    expect(result.verdictScore).toBeLessThan(55);
    expect(result.verdict).toBe("marginal");
  });
});

describe("computeMetrics — guarded division (zero/empty inputs)", () => {
  const result = computeMetrics(product(), settings());

  it("renders null instead of NaN/Infinity when price or cost is zero", () => {
    expect(result.marginPercent).toBeNull();
    expect(result.roiPercent).toBeNull();
    expect(Number.isNaN(result.profit)).toBe(false);
    expect(Number.isFinite(result.profit)).toBe(true);
  });

  it("still produces a finite, valid verdict", () => {
    expect(Number.isFinite(result.verdictScore)).toBe(true);
    expect(result.verdict).toBe("kill");
    expect(result.verdictScore).toBe(0);
  });

  it("every factor score is finite", () => {
    for (const factor of result.factors) {
      expect(Number.isFinite(factor.score)).toBe(true);
    }
  });
});

describe("computeMetrics — margin <= 0 always kills, regardless of other signals", () => {
  it("overrides a great ROI/demand/delivery profile when the product loses money", () => {
    const result = computeMetrics(
      product({
        costPriceAmount: 1,
        targetPrice: 1,
        competitorSoldCount: 5000,
        deliveryDays: 1,
      }),
      settings(),
    );
    expect(result.marginPercent).toBeLessThan(0);
    expect(result.verdict).toBe("kill");
  });
});

describe("computeMetrics — margin below the user's bar caps at 'marginal'", () => {
  it("never reads as viable/strong when margin misses minMarginPercent, even with maxed ROI/demand", () => {
    const result = computeMetrics(
      product({
        costPriceAmount: 1,
        targetPrice: 43,
        competitorSoldCount: 2000,
        deliveryDays: 5,
      }),
      settings(),
    );
    expect(result.marginPercent).toBeLessThan(baseSettings.minMarginPercent);
    expect(result.roiPercent).toBeGreaterThan(100); // ROI signal alone would say "great"
    expect(result.verdict).toBe("marginal");
  });
});

describe("computeMetrics — strong verdict", () => {
  it("rewards high margin, high ROI, high demand, and fast delivery", () => {
    const result = computeMetrics(
      product({
        costPriceAmount: 100,
        targetPrice: 1000,
        competitorSoldCount: 2000,
        deliveryDays: 5,
      }),
      settings(),
    );
    expect(result.verdict).toBe("strong");
    expect(result.verdictScore).toBeGreaterThanOrEqual(75);
  });
});

describe("computeMetrics — delivery penalty", () => {
  it("pulls the score down when delivery exceeds maxDeliveryDays, all else equal", () => {
    const fast = computeMetrics(
      product({ costPriceAmount: 210, targetPrice: 378, deliveryDays: 5, competitorSoldCount: 850 }),
      settings(),
    );
    const slow = computeMetrics(
      product({ costPriceAmount: 210, targetPrice: 378, deliveryDays: 60, competitorSoldCount: 850 }),
      settings(),
    );
    expect(slow.verdictScore).toBeLessThan(fast.verdictScore);
  });

  it("does not penalize when deliveryDays is unknown (null)", () => {
    const result = computeMetrics(
      product({ costPriceAmount: 210, targetPrice: 378, deliveryDays: null, competitorSoldCount: 850 }),
      settings(),
    );
    const deliveryFactor = result.factors.find((f) => f.label === "Delivery");
    expect(deliveryFactor?.score).toBe(0);
  });
});

describe("convertToGBPPence — multi-currency cost price", () => {
  it("converts a USD cost using the configured FX rate", () => {
    // $10.00 at 0.79 GBP/USD -> £7.90
    expect(convertToGBPPence(1000, "USD", baseSettings.fxRates)).toBe(790);
  });

  it("passes GBP through unchanged regardless of the rate table", () => {
    expect(convertToGBPPence(500, "GBP", baseSettings.fxRates)).toBe(500);
  });

  it("falls back to 0 for a missing or invalid rate instead of NaN", () => {
    expect(convertToGBPPence(500, "PKR", {} as SettingsInput["fxRates"])).toBe(0);
    expect(convertToGBPPence(500, "AUD", { ...baseSettings.fxRates, AUD: NaN })).toBe(0);
  });

  it("treats a zero or negative amount as 0", () => {
    expect(convertToGBPPence(0, "USD", baseSettings.fxRates)).toBe(0);
    expect(convertToGBPPence(-100, "USD", baseSettings.fxRates)).toBe(0);
  });

  it("flows through computeMetrics end to end", () => {
    const result = computeMetrics(
      product({ costPriceAmount: 1000, costPriceCurrency: "USD", targetPrice: 2000 }),
      settings(),
    );
    expect(result.costPriceGBP).toBe(790);
    expect(result.profit).toBe(2000 - 790 - calculateFees(2000, baseSettings));
  });
});

describe("VAT — manual settings field", () => {
  it("is zero when unset", () => {
    expect(calculateVat(1000, settings())).toBe(0);
  });

  it("is included in total cost and reduces profit accordingly", () => {
    const withVat = settings({ vatPercent: 20 });
    const result = computeMetrics(product({ costPriceAmount: 0, targetPrice: 1000 }), withVat);
    expect(result.vatDue).toBe(200);
    expect(result.totalCost).toBe(result.fees + 200); // cost=0, inbound=0
    expect(result.profit).toBe(1000 - result.fees - 200);
  });
});

describe("calculateBreakevenPrice", () => {
  it("finds the smallest integer price where profit is exactly >= 0", () => {
    const price = calculateBreakevenPrice(0, baseSettings);
    expect(price).not.toBeNull();
    const at = computeMetrics(product({ costPriceAmount: 0, targetPrice: price! }), settings());
    const belowIt = computeMetrics(product({ costPriceAmount: 0, targetPrice: price! - 1 }), settings());
    expect(at.profit).toBeGreaterThanOrEqual(0);
    expect(belowIt.profit).toBeLessThan(0);
  });

  it("returns null when fees alone consume the entire sale price", () => {
    expect(calculateBreakevenPrice(0, settings({ ebayFeePercent: 100 }))).toBeNull();
  });

  it("matches the breakevenPrice field computed inline by computeMetrics", () => {
    const result = computeMetrics(product(), settings());
    expect(result.breakevenPrice).toBe(calculateBreakevenPrice(0, baseSettings));
  });
});

describe("calculatePriceForMargin — reverse calculator", () => {
  it("solves a price that actually yields close to the requested margin", () => {
    const cost = 210;
    const price = calculatePriceForMargin(20, cost, baseSettings);
    expect(price).not.toBeNull();
    const result = computeMetrics(product({ costPriceAmount: cost, targetPrice: price! }), settings());
    expect(result.marginPercent).toBeCloseTo(20, 0); // within half a point
  });

  it("returns null when the requested margin is unreachable at any price", () => {
    expect(calculatePriceForMargin(90, 210, baseSettings)).toBeNull();
  });
});

describe("calculateFees", () => {
  it("is zero for a zero or negative target price", () => {
    expect(calculateFees(0, baseSettings)).toBe(0);
    expect(calculateFees(-100, baseSettings)).toBe(0);
  });
});
