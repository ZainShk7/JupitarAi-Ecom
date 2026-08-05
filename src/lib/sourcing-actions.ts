"use server";

import type { ActionResultWithData } from "@/lib/actions";
import { getAliExpressProductDetail, searchAliExpressProducts } from "@/lib/aliexpress";
import { getEbayProductDetail, searchEbayProducts } from "@/lib/ebay";
import type { SourcedProductDetail, SourcedProductSummary, SourcingProvider } from "@/lib/sourcing-types";

function fail(error: unknown): { ok: false; error: string } {
  return { ok: false, error: error instanceof Error ? error.message : "Something went wrong" };
}

export async function searchSourcedProducts(
  provider: SourcingProvider,
  query: string,
): Promise<ActionResultWithData<SourcedProductSummary[]>> {
  const trimmed = query.trim();
  if (!trimmed) return { ok: false, error: "Enter a search term" };
  try {
    const results =
      provider === "ebay" ? await searchEbayProducts(trimmed) : await searchAliExpressProducts(trimmed);
    return { ok: true, data: results };
  } catch (error) {
    return fail(error);
  }
}

export async function getSourcedProductDetail(
  provider: SourcingProvider,
  id: string,
): Promise<ActionResultWithData<SourcedProductDetail>> {
  try {
    const detail = provider === "ebay" ? await getEbayProductDetail(id) : await getAliExpressProductDetail(id);
    return { ok: true, data: detail };
  } catch (error) {
    return fail(error);
  }
}
