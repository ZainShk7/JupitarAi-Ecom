import type { CurrencyCode } from "@/lib/money";

export const SOURCING_PROVIDERS = ["ebay", "aliexpress"] as const;
export type SourcingProvider = (typeof SOURCING_PROVIDERS)[number];

export type SourcedProductSummary = {
  id: string;
  title: string;
  imageUrl: string | null;
  priceMinor: number;
  currency: CurrencyCode;
  soldCount: number | null;
  url: string;
};

export type SourcedProductDetail = SourcedProductSummary & {
  images: string[];
  description: string | null;
  category: string | null;
  condition: string | null;
  specifics: Record<string, string>;
};
