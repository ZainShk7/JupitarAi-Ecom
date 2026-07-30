"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useSettings } from "@/components/settings/settings-provider";
import { VerdictBadge } from "@/components/pipeline/verdict-badge";
import { VerdictGauge } from "@/components/pipeline/verdict-gauge";
import { StatusBadge } from "@/components/pipeline/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteProduct, updateProduct } from "@/lib/actions";
import { calculatePriceForMargin, computeMetrics } from "@/lib/metrics";
import { CURRENCIES, formatGBP, formatPercent, fromPence, toPence, type CurrencyCode } from "@/lib/money";
import { PRODUCT_STATUSES } from "@/lib/product-status";
import type { ProductFields } from "@/lib/product-schema";
import type { ProductRow } from "@/lib/products";
import { cn } from "@/lib/utils";

function toFields(product: ProductRow): ProductFields {
  return {
    name: product.name,
    category: product.category,
    sourceUrl: product.sourceUrl,
    costPriceAmount: product.costPriceAmount,
    costPriceCurrency: product.costPriceCurrency,
    deliveryDays: product.deliveryDays,
    targetPrice: product.targetPrice,
    competitorSoldCount: product.competitorSoldCount,
    status: product.status,
    notes: product.notes,
  };
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <h3 className="mb-3 text-[11px] uppercase tracking-wide text-ink-dim">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-ink-faint">{label}</Label>
      {children}
    </div>
  );
}

function FactorBar({
  label,
  score,
  weight,
  isPenalty,
}: {
  label: string;
  score: number;
  weight: number;
  isPenalty?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs text-ink-dim">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-hairline">
        <div
          className={cn("h-full rounded-full", isPenalty ? "bg-bad" : "bg-copper")}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <span className="tabular w-16 shrink-0 text-right text-xs text-ink-faint">
        {score.toFixed(0)} × {(weight * 100).toFixed(0)}%
      </span>
    </div>
  );
}

export function ProductDetail({ product }: { product: ProductRow }) {
  const router = useRouter();
  const { settings } = useSettings();
  const [fields, setFields] = useState<ProductFields>(() => toFields(product));
  const [marginTarget, setMarginTarget] = useState(String(settings.minMarginPercent));

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<Partial<ProductFields>>({});
  const snapshotRef = useRef<ProductFields | null>(null);

  const metrics = useMemo(() => computeMetrics(fields, settings), [fields, settings]);

  function commit(patch: Partial<ProductFields>) {
    if (!snapshotRef.current) snapshotRef.current = fields;
    setFields((prev) => ({ ...prev, ...patch }));
    pendingPatch.current = { ...pendingPatch.current, ...patch };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flush(), 400);
  }

  async function flush() {
    const patch = pendingPatch.current;
    pendingPatch.current = {};
    const snapshot = snapshotRef.current;
    snapshotRef.current = null;
    if (Object.keys(patch).length === 0) return;
    const result = await updateProduct(product.id, patch);
    if (!result.ok) {
      toast.error(`Couldn't save: ${result.error}`);
      if (snapshot) setFields(snapshot);
    }
  }

  async function handleDelete() {
    const result = await deleteProduct(product.id);
    if (!result.ok) {
      toast.error(`Couldn't delete: ${result.error}`);
      return;
    }
    toast.success(`Deleted "${fields.name}"`);
    router.push("/");
  }

  const priceForTargetMargin = useMemo(() => {
    const target = Number.parseFloat(marginTarget);
    if (!Number.isFinite(target)) return null;
    return calculatePriceForMargin(target, metrics.costPriceGBP, settings);
  }, [marginTarget, metrics.costPriceGBP, settings]);

  const waterfallTotal = Math.max(metrics.totalCost + Math.max(metrics.profit, 0), fields.targetPrice, 1);
  const segment = (value: number) => `${Math.max((value / waterfallTotal) * 100, 0)}%`;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 text-xs text-ink-dim hover:text-ink">
            <ArrowLeft className="size-3.5" />
            Pipeline
          </Link>
          <Button variant="ghost" size="icon-sm" aria-label="Delete product" onClick={() => void handleDelete()}>
            <Trash2 className="size-4" />
          </Button>
        </div>

        <Input
          value={fields.name}
          onChange={(event) => setFields((prev) => ({ ...prev, name: event.target.value }))}
          onBlur={(event) => commit({ name: event.target.value.trim() || fields.name })}
          aria-label="Product name"
          className="h-auto border-none bg-transparent px-0 font-display text-2xl font-semibold text-ink shadow-none focus-visible:ring-0"
        />

        <div className="flex flex-wrap items-center gap-8 rounded-xl border border-hairline bg-surface p-6">
          <VerdictGauge marginPercent={metrics.marginPercent} minMarginPercent={settings.minMarginPercent} size="lg" />
          <div className="flex flex-col gap-1">
            <span className="font-display text-4xl font-bold tabular text-ink">
              {formatPercent(metrics.marginPercent)}
            </span>
            <VerdictBadge verdict={metrics.verdict} />
          </div>
          <div className="flex min-w-64 flex-1 flex-col gap-2.5">
            {metrics.factors.map((factor) => (
              <FactorBar key={factor.label} {...factor} />
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup title="Product information">
            <FormField label="Category">
              <Input
                defaultValue={fields.category ?? ""}
                onBlur={(event) => commit({ category: event.target.value.trim() || null })}
                autoComplete="off"
                aria-label="Category"
              />
            </FormField>
            <FormField label="AliExpress URL">
              <div className="flex items-center gap-2">
                <Input
                  defaultValue={fields.sourceUrl ?? ""}
                  onBlur={(event) => commit({ sourceUrl: event.target.value.trim() || null })}
                  autoComplete="off"
                  aria-label="AliExpress URL"
                />
                {fields.sourceUrl ? (
                  <a
                    href={fields.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open AliExpress listing in a new tab"
                  >
                    <ExternalLink className="size-4 text-ink-dim hover:text-copper-bright" />
                  </a>
                ) : null}
              </div>
            </FormField>
          </FieldGroup>

          <FieldGroup title="AliExpress">
            <FormField label="Cost price">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  defaultValue={fromPence(fields.costPriceAmount)}
                  onBlur={(event) => {
                    const parsed = Number.parseFloat(event.target.value);
                    commit({ costPriceAmount: Number.isFinite(parsed) ? toPence(Math.max(parsed, 0)) : 0 });
                  }}
                  aria-label="Cost price"
                  className="tabular"
                />
                <Select
                  value={fields.costPriceCurrency}
                  onValueChange={(value) => commit({ costPriceCurrency: value as CurrencyCode })}
                >
                  <SelectTrigger size="sm" className="w-20" aria-label="Cost price currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {fields.costPriceCurrency !== "GBP" ? (
                <p className="text-[11px] text-ink-faint">= {formatGBP(metrics.costPriceGBP)}</p>
              ) : null}
            </FormField>
            <FormField label="Delivery days">
              <Input
                type="number"
                defaultValue={fields.deliveryDays ?? ""}
                onBlur={(event) => {
                  const parsed = Number.parseInt(event.target.value, 10);
                  commit({ deliveryDays: Number.isFinite(parsed) ? Math.max(parsed, 0) : null });
                }}
                aria-label="Delivery days"
                className="tabular"
              />
            </FormField>
          </FieldGroup>

          <FieldGroup title="eBay market metrics">
            <FormField label="Target selling price">
              <Input
                type="number"
                step="0.01"
                defaultValue={fromPence(fields.targetPrice)}
                onBlur={(event) => {
                  const parsed = Number.parseFloat(event.target.value);
                  commit({ targetPrice: Number.isFinite(parsed) ? toPence(Math.max(parsed, 0)) : 0 });
                }}
                aria-label="Target selling price"
                className="tabular"
              />
            </FormField>
            <FormField label="Competitor sold count">
              <Input
                type="number"
                defaultValue={fields.competitorSoldCount ?? ""}
                onBlur={(event) => {
                  const parsed = Number.parseInt(event.target.value, 10);
                  commit({ competitorSoldCount: Number.isFinite(parsed) ? Math.max(parsed, 0) : null });
                }}
                aria-label="Competitor sold count"
                className="tabular"
              />
            </FormField>
          </FieldGroup>

          <FieldGroup title="Decision & status">
            <FormField label="Status">
              <Select value={fields.status} onValueChange={(value) => commit({ status: value as ProductFields["status"] })}>
                <SelectTrigger size="sm" className="w-full" aria-label="Status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      <StatusBadge status={status} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Notes">
              <Textarea
                defaultValue={fields.notes ?? ""}
                onBlur={(event) => commit({ notes: event.target.value.trim() || null })}
                rows={3}
                aria-label="Notes"
              />
            </FormField>
          </FieldGroup>
        </div>

        <FieldGroup title="Cost → fees → profit waterfall">
          <div className="flex h-8 overflow-hidden rounded-md">
            <div
              className="flex items-center justify-center bg-mahogany text-[11px] text-ink"
              style={{ width: segment(metrics.costPriceGBP) }}
              title={`Cost ${formatGBP(metrics.costPriceGBP)}`}
            />
            <div
              className="flex items-center justify-center bg-oxblood text-[11px] text-ink"
              style={{ width: segment(metrics.fees + metrics.vatDue) }}
              title={`Fees + VAT ${formatGBP(metrics.fees + metrics.vatDue)}`}
            />
            <div
              className={cn(
                "flex items-center justify-center text-[11px] text-ink",
                metrics.profit >= 0 ? "bg-good" : "bg-bad",
              )}
              style={{ width: segment(Math.abs(metrics.profit)) }}
              title={`Profit ${formatGBP(metrics.profit)}`}
            />
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-ink-dim">
            <span>
              <span className="text-mahogany">■</span> Cost {formatGBP(metrics.costPriceGBP)}
            </span>
            <span>
              <span className="text-oxblood">■</span> Fees + VAT {formatGBP(metrics.fees + metrics.vatDue)}
            </span>
            <span>
              <span className={metrics.profit >= 0 ? "text-good" : "text-bad-text"}>■</span> Profit{" "}
              {formatGBP(metrics.profit)}
            </span>
            <span className="ml-auto">
              Breakeven price:{" "}
              <span className="tabular text-ink">
                {metrics.breakevenPrice == null ? "—" : formatGBP(metrics.breakevenPrice)}
              </span>
            </span>
          </div>
        </FieldGroup>

        <FieldGroup title="What price do I need?">
          <div className="flex items-center gap-2 text-sm text-ink-dim">
            <span>For</span>
            <Input
              type="number"
              value={marginTarget}
              onChange={(event) => setMarginTarget(event.target.value)}
              aria-label="Target margin percent"
              className="tabular h-8 w-20"
            />
            <span>% margin, price at</span>
            <span className="font-display tabular text-lg font-semibold text-copper-bright">
              {priceForTargetMargin == null ? "—" : formatGBP(priceForTargetMargin)}
            </span>
          </div>
        </FieldGroup>
      </div>
    </div>
  );
}
