"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { importProducts } from "@/lib/actions";
import { formatMoney } from "@/lib/money";
import { getSourcedProductDetail } from "@/lib/sourcing-actions";
import type { SourcedProductDetail, SourcedProductSummary, SourcingProvider } from "@/lib/sourcing-types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

export function ProductDetailDialog({
  provider,
  summary,
  onOpenChange,
}: {
  provider: SourcingProvider;
  summary: SourcedProductSummary | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={summary != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto sm:max-w-2xl">
        {summary ? (
          <ProductDetailBody provider={provider} summary={summary} onOpenChange={onOpenChange} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ProductDetailBody({
  provider,
  summary,
  onOpenChange,
}: {
  provider: SourcingProvider;
  summary: SourcedProductSummary;
  onOpenChange: (open: boolean) => void;
}) {
  const [detail, setDetail] = useState<SourcedProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSourcedProductDetail(provider, summary.id).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
      } else {
        setDetail(result.data);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [provider, summary.id]);

  async function handleAddToPipeline() {
    if (!detail) return;
    setAdding(true);
    try {
      const result = await importProducts([
        {
          name: detail.title,
          category: detail.category,
          sourceUrl: detail.url,
          costPriceAmount: detail.priceMinor,
          costPriceCurrency: detail.currency,
          deliveryDays: null,
          targetPrice: 0,
          competitorSoldCount: detail.soldCount,
          status: "researching",
          notes: null,
        },
      ]);
      if (!result.ok || result.data.imported === 0) {
        toast.error(result.ok ? "Couldn't add that product" : result.error);
        return;
      }
      toast.success(`Added "${detail.title}" to the pipeline`);
      onOpenChange(false);
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{detail?.title ?? summary.title}</DialogTitle>
        {detail ? (
          <DialogDescription>
            {formatMoney(detail.priceMinor, detail.currency)}
            {detail.condition ? ` · ${detail.condition}` : ""}
            {detail.category ? ` · ${detail.category}` : ""}
          </DialogDescription>
        ) : null}
      </DialogHeader>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : null}

      {error ? <p className="text-sm text-bad-text">{error}</p> : null}

      {!loading && detail ? (
        <div className="flex flex-col gap-4">
          {detail.images.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto">
              {detail.images.slice(0, 8).map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt={detail.title}
                  className="h-32 w-32 shrink-0 rounded-lg object-cover"
                />
              ))}
            </div>
          ) : null}

          {detail.description ? (
            <p className="max-h-40 overflow-y-auto text-sm text-ink-dim">{detail.description}</p>
          ) : null}

          {Object.keys(detail.specifics).length > 0 ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {Object.entries(detail.specifics).map(([name, value]) => (
                <div key={name} className="contents">
                  <dt className="text-ink-faint">{name}</dt>
                  <dd className="text-ink-dim">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
        <Button disabled={!detail || adding} onClick={() => void handleAddToPipeline()}>
          {adding ? "Adding…" : "Add to Pipeline"}
        </Button>
      </DialogFooter>
    </>
  );
}
