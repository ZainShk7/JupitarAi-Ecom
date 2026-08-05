"use client";

import { useState } from "react";
import { SearchIcon } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { searchSourcedProducts } from "@/lib/sourcing-actions";
import type { SourcedProductSummary, SourcingProvider } from "@/lib/sourcing-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductDetailDialog } from "@/components/sourcing/product-detail-dialog";

const PROVIDER_LABEL: Record<SourcingProvider, string> = {
  ebay: "eBay",
  aliexpress: "AliExpress",
};

export function SourcingPanel({ provider }: { provider: SourcingProvider }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SourcedProductSummary[] | null>(null);
  const [selected, setSelected] = useState<SourcedProductSummary | null>(null);

  async function handleSearch() {
    setLoading(true);
    setError(null);
    try {
      const result = await searchSourcedProducts(provider, query);
      if (!result.ok) {
        setError(result.error);
        setResults(null);
        return;
      }
      setResults(result.data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 pt-4">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSearch();
        }}
      >
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${PROVIDER_LABEL[provider]} products…`}
          className="max-w-md"
        />
        <Button type="submit" disabled={loading || query.trim().length === 0}>
          <SearchIcon />
          {loading ? "Searching…" : "Search"}
        </Button>
      </form>

      {error ? (
        <p className="rounded-lg border border-bad/40 bg-surface px-3 py-2 text-sm text-bad-text">{error}</p>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[3/4] w-full" />
          ))}
        </div>
      ) : null}

      {!loading && results && results.length === 0 ? (
        <p className="text-sm text-ink-faint">No results for &ldquo;{query}&rdquo;.</p>
      ) : null}

      {!loading && results && results.length > 0 ? (
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-auto sm:grid-cols-3 lg:grid-cols-4">
          {results.map((product) => (
            <button
              key={product.id}
              onClick={() => setSelected(product)}
              className="flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface text-left transition-colors hover:border-edge"
            >
              <div className="aspect-square w-full overflow-hidden bg-raised">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                ) : null}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-2.5">
                <p className="line-clamp-2 text-xs text-ink">{product.title}</p>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <span className="tabular text-sm font-medium text-ink">
                    {formatMoney(product.priceMinor, product.currency)}
                  </span>
                  {product.soldCount != null ? (
                    <Badge variant="outline">{product.soldCount} sold</Badge>
                  ) : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      <ProductDetailDialog
        provider={provider}
        summary={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
