"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Link from "next/link";
import { useSettings } from "@/components/settings/settings-provider";
import { computeMetrics } from "@/lib/metrics";
import { formatGBP, formatPercent, fromPence } from "@/lib/money";
import type { ProductRow } from "@/lib/products";

const MARGIN_BUCKETS = [
  { label: "<0%", min: -Infinity, max: 0 },
  { label: "0–10%", min: 0, max: 10 },
  { label: "10–20%", min: 10, max: 20 },
  { label: "20–30%", min: 20, max: 30 },
  { label: "30–40%", min: 30, max: 40 },
  { label: "40%+", min: 40, max: Infinity },
];

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function KpiTile({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <p className="text-[11px] uppercase tracking-wide text-ink-dim">{label}</p>
      <p
        className={
          "font-display tabular mt-1 text-3xl font-bold " + (highlight ? "text-copper-bright" : "text-ink")
        }
      >
        {value}
      </p>
      {sub ? <p className="mt-1 truncate text-xs text-ink-faint">{sub}</p> : null}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <p className="mb-3 text-[11px] uppercase tracking-wide text-ink-dim">{title}</p>
      {children}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  render,
}: {
  active?: boolean;
  payload?: Array<{ payload: Record<string, unknown> }>;
  render: (data: Record<string, unknown>) => React.ReactNode;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-hairline bg-raised px-3 py-2 text-xs shadow-lg">
      {render(payload[0].payload)}
    </div>
  );
}

export function Dashboard({ rows }: { rows: ProductRow[] }) {
  const { settings } = useSettings();

  const effectiveRows = useMemo(
    () => rows.map((row) => ({ ...row, metrics: computeMetrics(row, settings) })),
    [rows, settings],
  );

  const kpis = useMemo(() => {
    const shortlisted = effectiveRows.filter((r) => r.status === "shortlisted");
    const shortlistedMargins = shortlisted
      .map((r) => r.metrics.marginPercent)
      .filter((v): v is number => v != null);
    const medianShortlistedMargin = median(shortlistedMargins);

    const bestRoi = effectiveRows.reduce<ProductRow | null>((best, row) => {
      if (row.metrics.roiPercent == null) return best;
      if (!best || best.metrics.roiPercent == null || row.metrics.roiPercent > best.metrics.roiPercent) {
        return row;
      }
      return best;
    }, null);

    const clearingBar = effectiveRows.filter(
      (r) => r.metrics.marginPercent != null && r.metrics.marginPercent >= settings.minMarginPercent,
    ).length;

    return {
      total: effectiveRows.length,
      shortlistedCount: shortlisted.length,
      medianShortlistedMargin,
      bestRoi,
      clearingBar,
    };
  }, [effectiveRows, settings.minMarginPercent]);

  const histogramData = useMemo(() => {
    return MARGIN_BUCKETS.map((bucket) => {
      const bar = settings.minMarginPercent;
      const status: "below" | "straddles" | "clears" =
        bucket.max <= bar ? "below" : bucket.min >= bar ? "clears" : "straddles";
      return {
        label: bucket.label,
        status,
        count: effectiveRows.filter((row) => {
          const margin = row.metrics.marginPercent;
          return margin != null && margin >= bucket.min && margin < bucket.max;
        }).length,
      };
    });
  }, [effectiveRows, settings.minMarginPercent]);

  const BUCKET_STATUS_COLOR: Record<string, string> = {
    below: "var(--color-bad)",
    straddles: "var(--color-warn)",
    clears: "var(--color-copper)",
  };

  const scatterData = useMemo(() => {
    return effectiveRows
      .filter((row) => row.metrics.marginPercent != null)
      .map((row) => ({
        cost: fromPence(row.metrics.costPriceGBP),
        margin: row.metrics.marginPercent as number,
        name: row.name,
      }));
  }, [effectiveRows]);

  const medianCost = useMemo(() => median(scatterData.map((d) => d.cost)), [scatterData]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiTile label="Pipeline" value={kpis.total.toLocaleString()} sub={`${kpis.shortlistedCount} shortlisted`} />
          <KpiTile
            label="Median margin (shortlisted)"
            value={formatPercent(kpis.medianShortlistedMargin)}
          />
          <KpiTile
            label="Best ROI"
            value={kpis.bestRoi ? formatPercent(kpis.bestRoi.metrics.roiPercent) : "—"}
            sub={kpis.bestRoi?.name}
            highlight
          />
          <KpiTile label="Clear your bar" value={kpis.clearingBar.toLocaleString()} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ChartCard title="Margin distribution">
            <BarChart width={460} height={260} data={histogramData} barCategoryGap="20%">
              <CartesianGrid vertical={false} stroke="var(--color-hairline)" />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--color-ink-dim)", fontSize: 11 }}
                axisLine={{ stroke: "var(--color-hairline)" }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "var(--color-ink-dim)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    render={(d) => (
                      <>
                        <p className="tabular font-semibold text-ink">{String(d.count)} products</p>
                        <p className="text-ink-faint">{String(d.label)} margin</p>
                      </>
                    )}
                  />
                }
                cursor={{ fill: "var(--color-raised)" }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {histogramData.map((bucket, index) => (
                  <Cell key={index} fill={BUCKET_STATUS_COLOR[bucket.status]} />
                ))}
              </Bar>
            </BarChart>
            <p className="mt-2 text-[11px] text-ink-faint">
              <span className="text-bad">■</span> below your {settings.minMarginPercent}% bar ·{" "}
              <span className="text-copper">■</span> clears it
            </p>
          </ChartCard>

          <ChartCard title="Cost vs. margin">
            <ScatterChart width={460} height={260} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--color-hairline)" />
              <XAxis
                type="number"
                dataKey="cost"
                name="Cost"
                unit="£"
                tick={{ fill: "var(--color-ink-dim)", fontSize: 11 }}
                axisLine={{ stroke: "var(--color-hairline)" }}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey="margin"
                name="Margin"
                unit="%"
                tick={{ fill: "var(--color-ink-dim)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              {medianCost != null ? (
                <ReferenceLine
                  x={medianCost}
                  stroke="var(--color-ink-faint)"
                  strokeDasharray="4 4"
                />
              ) : null}
              <ReferenceLine
                y={settings.minMarginPercent}
                stroke="var(--color-warn)"
                strokeDasharray="4 4"
              />
              <Tooltip
                content={
                  <ChartTooltip
                    render={(d) => (
                      <>
                        <p className="tabular font-semibold text-ink">
                          {formatPercent(d.margin as number)} margin
                        </p>
                        <p className="tabular text-ink-faint">{formatGBP(Math.round((d.cost as number) * 100))} cost</p>
                        <p className="max-w-48 truncate text-ink-faint">{String(d.name)}</p>
                      </>
                    )}
                  />
                }
                cursor={{ stroke: "var(--color-edge)" }}
              />
              <Scatter data={scatterData} fill="var(--color-copper-bright)">
                {scatterData.map((_, index) => (
                  <Cell key={index} stroke="var(--color-surface)" strokeWidth={2} />
                ))}
              </Scatter>
            </ScatterChart>
            <p className="mt-2 text-[11px] text-ink-faint">
              Vertical line: median cost. Horizontal line: your {settings.minMarginPercent}% bar.
            </p>
          </ChartCard>
        </div>

        {kpis.bestRoi ? (
          <Link
            href={`/p/${kpis.bestRoi.id}`}
            className="text-center text-xs text-ink-faint hover:text-ink-dim"
          >
            View best-ROI product →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
