import { CURRENCIES, type CurrencyCode } from "@/lib/money";
import type { SourcedProductDetail, SourcedProductSummary } from "@/lib/sourcing-types";

const EBAY_MARKETPLACE_ID = process.env.EBAY_MARKETPLACE_ID ?? "EBAY_GB";
const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const BROWSE_URL = "https://api.ebay.com/buy/browse/v1";

let cachedToken: { value: string; expiresAt: number } | null = null;

function requireCredentials() {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("eBay isn't configured — add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET to .env.local");
  }
  return { clientId, clientSecret };
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const { clientId, clientSecret } = requireCredentials();
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
  });
  if (!response.ok) {
    throw new Error(`eBay auth failed (${response.status}): ${await response.text()}`);
  }
  const data = (await response.json()) as { access_token: string; expires_in: number };
  // Refresh a little early so a slow-running request never uses an expired token.
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.value;
}

function toCurrencyCode(code: string): CurrencyCode {
  return (CURRENCIES as readonly string[]).includes(code) ? (code as CurrencyCode) : "USD";
}

async function ebayFetch(path: string): Promise<unknown> {
  const token = await getAccessToken();
  const response = await fetch(`${BROWSE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": EBAY_MARKETPLACE_ID,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`eBay API error (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

type EbayItemSummary = {
  itemId: string;
  title: string;
  image?: { imageUrl: string };
  price?: { value: string; currency: string };
  itemWebUrl: string;
};

export async function searchEbayProducts(query: string): Promise<SourcedProductSummary[]> {
  const params = new URLSearchParams({ q: query, limit: "24" });
  const data = (await ebayFetch(`/item_summary/search?${params}`)) as {
    itemSummaries?: EbayItemSummary[];
  };
  return (data.itemSummaries ?? []).map((item) => ({
    id: item.itemId,
    title: item.title,
    imageUrl: item.image?.imageUrl ?? null,
    priceMinor: Math.round(parseFloat(item.price?.value ?? "0") * 100),
    currency: toCurrencyCode(item.price?.currency ?? "USD"),
    // The Browse API doesn't expose a sold/quantity-sold count publicly.
    soldCount: null,
    url: item.itemWebUrl,
  }));
}

type EbayItemDetail = EbayItemSummary & {
  image?: { imageUrl: string };
  additionalImages?: { imageUrl: string }[];
  shortDescription?: string;
  description?: string;
  condition?: string;
  categoryPath?: string;
  localizedAspects?: { name: string; value: string }[];
};

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getEbayProductDetail(itemId: string): Promise<SourcedProductDetail> {
  const item = (await ebayFetch(`/item/${encodeURIComponent(itemId)}`)) as EbayItemDetail;
  const specifics: Record<string, string> = {};
  for (const aspect of item.localizedAspects ?? []) {
    specifics[aspect.name] = aspect.value;
  }
  return {
    id: item.itemId,
    title: item.title,
    imageUrl: item.image?.imageUrl ?? null,
    priceMinor: Math.round(parseFloat(item.price?.value ?? "0") * 100),
    currency: toCurrencyCode(item.price?.currency ?? "USD"),
    soldCount: null,
    url: item.itemWebUrl,
    images: [item.image?.imageUrl, ...(item.additionalImages?.map((i) => i.imageUrl) ?? [])].filter(
      (url): url is string => Boolean(url),
    ),
    description: item.description ? stripHtml(item.description) : (item.shortDescription ?? null),
    category: item.categoryPath ?? null,
    condition: item.condition ?? null,
    specifics,
  };
}
