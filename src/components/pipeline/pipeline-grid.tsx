"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type Header,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink } from "lucide-react";
import {
  parseAsArrayOf,
  parseAsFloat,
  parseAsString,
  parseAsStringEnum,
  useQueryStates,
} from "nuqs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PRODUCT_STATUSES, type ProductStatus } from "@/lib/product-status";
import { formatGBP, formatMoney, formatPercent } from "@/lib/money";
import type { ProductRow } from "@/lib/products";
import { cn } from "@/lib/utils";
import { PipelineToolbar } from "./pipeline-toolbar";
import { StatusBadge } from "./status-badge";
import { VerdictBadge } from "./verdict-badge";
import { VerdictGauge } from "./verdict-gauge";

const ROW_HEIGHT = 40;
const GROUP_HEADER_HEIGHT = 28;
const COLUMN_HEADER_HEIGHT = 32;

const filterParsers = {
  q: parseAsString.withDefault(""),
  status: parseAsArrayOf(parseAsStringEnum<ProductStatus>([...PRODUCT_STATUSES])).withDefault([]),
  category: parseAsString.withDefault(""),
  minMargin: parseAsFloat.withDefault(0),
  sort: parseAsString.withDefault(""),
  dir: parseAsStringEnum(["asc", "desc"]).withDefault("desc"),
};

function compareNullable(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // nulls sort last regardless of direction
  if (b == null) return -1;
  return a - b;
}

function marginTone(marginPercent: number | null, minMarginPercent: number): string {
  if (marginPercent == null) return "text-ink-faint";
  if (marginPercent <= 0) return "text-bad";
  if (marginPercent < minMarginPercent) return "text-warn";
  return "text-good";
}

/** Group headers report their own size as 0 — real width is the sum of their leaf columns. */
function headerWidth(header: Header<ProductRow, unknown>): number {
  if (header.subHeaders.length > 0) {
    return header.column.getLeafColumns().reduce((sum, col) => sum + col.getSize(), 0);
  }
  return header.getSize();
}

function SortIcon({ direction }: { direction: false | "asc" | "desc" }) {
  if (direction === "asc") return <ArrowUp className="ml-1 size-3" />;
  if (direction === "desc") return <ArrowDown className="ml-1 size-3" />;
  return <ArrowUpDown className="ml-1 size-3 opacity-40" />;
}

function NumericCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("tabular w-full text-right font-medium", className)}>{children}</div>;
}

function TruncatedText({ value, muted }: { value: string; muted?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("block truncate", muted && "text-ink-dim")}>{value}</span>
      </TooltipTrigger>
      <TooltipContent>{value}</TooltipContent>
    </Tooltip>
  );
}

const columnHelper = createColumnHelper<ProductRow>();

export function PipelineGrid({
  rows,
  categories,
  minMarginPercent,
}: {
  rows: ProductRow[];
  categories: string[];
  minMarginPercent: number;
}) {
  const [filters, setFilters] = useQueryStates(filterParsers);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isTyping) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const stats = useMemo(() => {
    const shortlisted = rows.filter((row) => row.status === "shortlisted").length;
    const clearingBar = rows.filter(
      (row) => row.metrics.marginPercent != null && row.metrics.marginPercent >= minMarginPercent,
    ).length;
    return { total: rows.length, shortlisted, clearingBar };
  }, [rows, minMarginPercent]);

  const filteredRows = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return rows.filter((row) => {
      if (filters.status.length > 0 && !filters.status.includes(row.status)) return false;
      if (filters.category && row.category !== filters.category) return false;
      if (filters.minMargin > 0) {
        if (row.metrics.marginPercent == null || row.metrics.marginPercent < filters.minMargin) {
          return false;
        }
      }
      if (q) {
        const haystack = `${row.name} ${row.category ?? ""} ${row.notes ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filters.q, filters.status, filters.category, filters.minMargin]);

  const columns = useMemo(
    () => [
      columnHelper.group({
        id: "product",
        header: "Product information",
        columns: [
          columnHelper.accessor("name", {
            header: "Name",
            size: 320,
            cell: (info) => <TruncatedText value={info.getValue()} />,
          }),
          columnHelper.accessor((row) => row.category ?? "—", {
            id: "category",
            header: "Category",
            size: 150,
            cell: (info) => <TruncatedText value={info.getValue()} muted />,
          }),
          columnHelper.accessor("sourceUrl", {
            header: "",
            size: 36,
            enableSorting: false,
            cell: (info) => {
              const url = info.getValue();
              if (!url) return <span className="text-ink-faint">—</span>;
              return (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink-dim transition-colors hover:text-copper-bright"
                  aria-label="Open AliExpress listing"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              );
            },
          }),
        ],
      }),
      columnHelper.group({
        id: "aliexpress",
        header: "AliExpress",
        columns: [
          columnHelper.accessor((row) => row.metrics.costPriceGBP, {
            id: "costPriceGBP",
            header: "Cost",
            size: 110,
            cell: (info) => {
              const row = info.row.original;
              return (
                <NumericCell>
                  {formatGBP(row.metrics.costPriceGBP)}
                  {row.costPriceCurrency !== "GBP" ? (
                    <span className="ml-1 text-[10px] text-ink-faint">
                      ({formatMoney(row.costPriceAmount, row.costPriceCurrency)})
                    </span>
                  ) : null}
                </NumericCell>
              );
            },
          }),
          columnHelper.accessor("deliveryDays", {
            header: "Days",
            size: 64,
            cell: (info) => <NumericCell>{info.getValue() ?? "—"}</NumericCell>,
          }),
        ],
      }),
      columnHelper.group({
        id: "ebay",
        header: "eBay market metrics",
        columns: [
          columnHelper.accessor("targetPrice", {
            header: "Target",
            size: 90,
            cell: (info) => <NumericCell>{formatGBP(info.getValue())}</NumericCell>,
          }),
          columnHelper.accessor("competitorSoldCount", {
            header: "Sold",
            size: 80,
            sortingFn: (rowA, rowB) =>
              compareNullable(rowA.original.competitorSoldCount, rowB.original.competitorSoldCount),
            cell: (info) => <NumericCell>{info.getValue() ?? "—"}</NumericCell>,
          }),
          columnHelper.accessor((row) => row.metrics.fees, {
            id: "fees",
            header: "Fees",
            size: 84,
            cell: (info) => <NumericCell>{formatGBP(info.getValue())}</NumericCell>,
          }),
          columnHelper.accessor((row) => row.metrics.totalCost, {
            id: "totalCost",
            header: "Total cost",
            size: 100,
            cell: (info) => <NumericCell>{formatGBP(info.getValue())}</NumericCell>,
          }),
          columnHelper.accessor((row) => row.metrics.marginPercent, {
            id: "marginPercent",
            header: "Margin",
            size: 90,
            sortingFn: (rowA, rowB) =>
              compareNullable(rowA.original.metrics.marginPercent, rowB.original.metrics.marginPercent),
            cell: (info) => (
              <NumericCell className={marginTone(info.getValue(), minMarginPercent)}>
                {formatPercent(info.getValue())}
              </NumericCell>
            ),
          }),
          columnHelper.accessor((row) => row.metrics.roiPercent, {
            id: "roiPercent",
            header: "ROI",
            size: 84,
            sortingFn: (rowA, rowB) =>
              compareNullable(rowA.original.metrics.roiPercent, rowB.original.metrics.roiPercent),
            cell: (info) => <NumericCell>{formatPercent(info.getValue())}</NumericCell>,
          }),
        ],
      }),
      columnHelper.group({
        id: "decision",
        header: "Decision & status",
        columns: [
          columnHelper.accessor("status", {
            header: "Status",
            size: 130,
            cell: (info) => <StatusBadge status={info.getValue()} />,
          }),
          columnHelper.accessor((row) => row.metrics.verdictScore, {
            id: "verdict",
            header: "Verdict",
            size: 150,
            cell: (info) => {
              const row = info.row.original;
              return (
                <div className="flex items-center gap-2">
                  <VerdictGauge
                    marginPercent={row.metrics.marginPercent}
                    minMarginPercent={minMarginPercent}
                  />
                  <VerdictBadge verdict={row.metrics.verdict} />
                </div>
              );
            },
          }),
          columnHelper.accessor((row) => row.notes ?? "—", {
            id: "notes",
            header: "Notes",
            size: 220,
            cell: (info) => <TruncatedText value={info.getValue()} muted />,
          }),
        ],
      }),
    ],
    [minMarginPercent],
  );

  const sorting: SortingState = useMemo(
    () => (filters.sort ? [{ id: filters.sort, desc: filters.dir === "desc" }] : []),
    [filters.sort, filters.dir],
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      const first = next[0];
      void setFilters({ sort: first?.id ?? "", dir: first?.desc ? "desc" : "asc" });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const tableRows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const totalWidth = table.getTotalSize();
  const headerGroups = table.getHeaderGroups();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PipelineToolbar
        categories={categories}
        filters={filters}
        setFilters={(partial) => void setFilters(partial)}
        searchInputRef={searchInputRef}
        shownCount={filteredRows.length}
        totalCount={rows.length}
      />
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">
        <div style={{ width: totalWidth, minWidth: "100%" }}>
          {headerGroups.map((headerGroup, depth) => (
            <div
              key={headerGroup.id}
              className="sticky z-10 flex border-b border-hairline bg-surface"
              style={{
                top: depth === 0 ? 0 : GROUP_HEADER_HEIGHT,
                height: depth === 0 ? GROUP_HEADER_HEIGHT : COLUMN_HEADER_HEIGHT,
              }}
            >
              {headerGroup.headers.map((header) => (
                <div
                  key={header.id}
                  style={{ width: headerWidth(header) }}
                  className={cn(
                    "flex items-center border-r border-hairline/60 px-2 text-[11px] uppercase tracking-wide text-ink-dim",
                    depth === 0 && "font-semibold text-ink-dim/80",
                    header.column.getCanSort() && "cursor-pointer select-none hover:text-ink",
                  )}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {depth > 0 && header.column.getCanSort() ? (
                    <SortIcon direction={header.column.getIsSorted()} />
                  ) : null}
                </div>
              ))}
            </div>
          ))}
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = tableRows[virtualRow.index];
              return (
                <div
                  key={row.id}
                  className="absolute left-0 flex w-full border-b border-hairline/60 hover:bg-raised"
                  style={{ top: virtualRow.start, height: virtualRow.size }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className="flex items-center overflow-hidden border-r border-hairline/40 px-2 text-sm text-ink"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
              );
            })}
            {tableRows.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-ink-faint">
                No products match these filters.
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 border-t border-hairline bg-surface px-4 py-2 text-xs text-ink-dim">
        <span>{stats.total.toLocaleString()} products</span>
        <span>·</span>
        <span>{stats.shortlisted.toLocaleString()} shortlisted</span>
        <span>·</span>
        <span>{stats.clearingBar.toLocaleString()} clear your bar</span>
      </div>
    </div>
  );
}
