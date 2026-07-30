import { describe, expect, it } from "vitest";
import { formatGBP, formatMoney, formatPercent, fromPence, toPence } from "@/lib/money";

describe("toPence / fromPence", () => {
  it("round-trips a major-unit amount", () => {
    expect(toPence(3.78)).toBe(378);
    expect(fromPence(378)).toBeCloseTo(3.78);
  });

  it("rounds fractional pence instead of truncating", () => {
    expect(toPence(2.005)).toBe(201); // 200.5 -> banker's-adjacent rounding via Math.round
    expect(toPence(0.1 + 0.2)).toBe(30); // guards against classic float drift
  });

  it("handles zero and negative amounts", () => {
    expect(toPence(0)).toBe(0);
    expect(toPence(-5)).toBe(-500);
  });
});

describe("formatGBP", () => {
  it("formats a positive pence value as GBP", () => {
    expect(formatGBP(378)).toBe("£3.78");
  });

  it("formats zero and negative values without throwing", () => {
    expect(formatGBP(0)).toBe("£0.00");
    expect(formatGBP(-150)).toContain("1.50");
  });

  it("renders null, undefined, NaN, and Infinity as an em dash, never as a broken number", () => {
    expect(formatGBP(null)).toBe("—");
    expect(formatGBP(undefined)).toBe("—");
    expect(formatGBP(NaN)).toBe("—");
    expect(formatGBP(Infinity)).toBe("—");
    expect(formatGBP(-Infinity)).toBe("—");
  });
});

describe("formatMoney", () => {
  it("formats every supported currency", () => {
    expect(formatMoney(1000, "USD")).toBe("$10.00");
    expect(formatMoney(1000, "EUR")).toContain("10.00");
    expect(formatMoney(1000, "AUD")).toContain("10.00");
    expect(formatMoney(100000, "PKR")).toContain("1,000.00");
  });

  it("guards missing input the same way as formatGBP", () => {
    expect(formatMoney(null, "USD")).toBe("—");
    expect(formatMoney(NaN, "EUR")).toBe("—");
  });
});

describe("formatPercent", () => {
  it("formats with the requested precision", () => {
    expect(formatPercent(23.809, 1)).toBe("23.8%");
    expect(formatPercent(23.809, 0)).toBe("24%");
  });

  it("renders null/undefined/NaN as an em dash", () => {
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(undefined)).toBe("—");
    expect(formatPercent(NaN)).toBe("—");
  });
});
