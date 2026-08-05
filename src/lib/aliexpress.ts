import { CURRENCIES, type CurrencyCode } from "@/lib/money";
import type { SourcedProductDetail, SourcedProductSummary } from "@/lib/sourcing-types";

/**
 * AliExpress has no official public product API. This targets the
 * "Aliexpress DataHub" RapidAPI listing. The item shape below (itemId,
 * title, sales, itemUrl, image, sku.def.promotionPrice) is confirmed
 * against a live response from that API's image-search endpoint —
 * the keyword-search endpoint's exact path/param name and the item
 * detail endpoint's shape are still unconfirmed placeholders, flagged
 * below. mapItem/mapDetailItem are the only places that need adjusting.
 */

function requireCredentials() {
  const apiKey = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_ALIEXPRESS_HOST;
  if (!apiKey || !host) {
    throw new Error(
      "AliExpress isn't configured — add RAPIDAPI_KEY and RAPIDAPI_ALIEXPRESS_HOST to .env.local",
    );
  }
  return { apiKey, host };
}

async function rapidApiFetch(path: string, params: Record<string, string>): Promise<unknown> {
  const { apiKey, host } = requireCredentials();
  const url = `https://${host}${path}?${new URLSearchParams(params)}`;
  const response = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": host,
    },
  });
  if (!response.ok) {
    throw new Error(`AliExpress API error (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

function toCurrencyCode(code: string | undefined): CurrencyCode {
  const upper = (code ?? "USD").toUpperCase();
  return (CURRENCIES as readonly string[]).includes(upper) ? (upper as CurrencyCode) : "USD";
}

/** DataHub returns protocol-relative URLs (e.g. "//ae-pic-a1...."). */
function withProtocol(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("//") ? `https:${url}` : url;
}

type RawItem = {
  itemId?: string;
  title?: string;
  sales?: number;
  itemUrl?: string;
  image?: string;
  sku?: { def?: { price?: number | null; promotionPrice?: number | null } };
};

function mapItem(raw: RawItem, currency: CurrencyCode): SourcedProductSummary {
  const id = String(raw.itemId ?? "");
  const price = raw.sku?.def?.promotionPrice ?? raw.sku?.def?.price ?? 0;
  return {
    id,
    title: raw.title ?? "Untitled product",
    imageUrl: withProtocol(raw.image),
    priceMinor: Math.round((price ?? 0) * 100),
    currency,
    soldCount: raw.sales ?? null,
    url: withProtocol(raw.itemUrl) ?? `https://www.aliexpress.com/item/${id}.html`,
  };
}

export async function searchAliExpressProducts(query: string): Promise<SourcedProductSummary[]> {
  // TODO: confirm the real keyword-search endpoint path + query param name
  // (this API's search variants are named "Item Search #2/#3" on RapidAPI —
  // "/item_search" with "q" is an unconfirmed guess for now).
  const data = (await rapidApiFetch("/item_search", { q: query, page: "1" })) as {
    result?: { settings?: { currency?: string }; resultList?: { item?: RawItem }[] };
  };
  const currency = toCurrencyCode(data.result?.settings?.currency);
  const list = data.result?.resultList ?? [];
  return list.map((entry) => mapItem(entry.item ?? {}, currency)).filter((item) => item.id);
}

type RawDetailItem = RawItem & {
  images?: string[];
  description?: string;
  category?: string;
  categoryName?: string;
  condition?: string;
  properties?: { name?: string; value?: string }[];
};

function mapDetailItem(raw: RawDetailItem, currency: CurrencyCode): SourcedProductDetail {
  const summary = mapItem(raw, currency);
  const specifics: Record<string, string> = {};
  for (const property of raw.properties ?? []) {
    if (property.name && property.value) specifics[property.name] = property.value;
  }
  return {
    ...summary,
    images: (raw.images ?? []).map(withProtocol).filter((url): url is string => Boolean(url)),
    description: raw.description ?? null,
    category: raw.category ?? raw.categoryName ?? null,
    condition: raw.condition ?? "New",
    specifics,
  };
}

export async function getAliExpressProductDetail(itemId: string): Promise<SourcedProductDetail> {
  // TODO: confirm the real item-detail endpoint path + response shape
  // (this API lists "Item Detail #2/#3/#6" on RapidAPI — "/item_detail"
  // with "itemId" is an unconfirmed guess for now).
  const data = (await rapidApiFetch("/item_detail", { itemId })) as {
    result?: { settings?: { currency?: string }; item?: RawDetailItem };
  };
  if (!data.result?.item) throw new Error("AliExpress returned no product detail");
  const currency = toCurrencyCode(data.result.settings?.currency);
  return mapDetailItem(data.result.item, currency);
}
