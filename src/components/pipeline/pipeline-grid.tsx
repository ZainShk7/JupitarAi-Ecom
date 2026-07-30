"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { toast } from "sonner";
import {
  createProduct,
  deleteProduct,
  duplicateProduct,
  restoreProduct,
  updateProduct,
} from "@/lib/actions";
import { computeMetrics, type SettingsInput } from "@/lib/metrics";
import { CURRENCIES, formatGBP, formatPercent, fromPence, toPence } from "@/lib/money";
import { NEW_PRODUCT_DEFAULTS, type ProductFields } from "@/lib/product-schema";
import { PRODUCT_STATUSES, type ProductStatus } from "@/lib/product-status";
import type { ProductRow } from "@/lib/products";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EditableInput, EditableSelect, type MoveDirection } from "./editable-cell";
import { PipelineToolbar } from "./pipeline-toolbar";
import { RowActions } from "./pipeline-row-actions";
import { StatusBadge } from "./status-badge";
import { VerdictBadge } from "./verdict-badge";
import { VerdictGauge } from "./verdict-gauge";

const ROW_HEIGHT = 40;
const GROUP_HEADER_HEIGHT = 28;
const COLUMN_HEADER_HEIGHT = 32;

// Tab order for keyboard flow across editable cells within a row.
const EDITABLE_COLUMN_ORDER = [
  "name",
  "category",
  "sourceUrl",
  "costPriceAmount",
  "deliveryDays",
  "targetPrice",
  "competitorSoldCount",
  "status",
  "notes",
] as const;

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

interface EditingCell {
  rowId: string;
  columnId: string;
}

export function PipelineGrid({
  rows,
  categories,
  settings,
}: {
  rows: ProductRow[];
  categories: string[];
  settings: SettingsInput;
}) {
  const minMarginPercent = settings.minMarginPercent;
  const [filters, setFilters] = useQueryStates(filterParsers);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [committedRows, setCommittedRows] = useState(rows);
  useEffect(() => setCommittedRows(rows), [rows]);

  // Uncommitted per-row field drafts, applied on top of committedRows so
  // derived columns (fees/margin/ROI/verdict) recompute live while typing —
  // the save to the server is debounced, the display recalculation never is.
  const [liveEdits, setLiveEdits] = useState<Record<string, Partial<ProductFields>>>({});
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingPatches = useRef<Record<string, Partial<ProductFields>>>({});
  const pendingSnapshots = useRef<Record<string, ProductRow>>({});

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (
        event.key === "n" &&
        !isTyping &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        void handleCreate();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectiveRows = useMemo(() => {
    if (Object.keys(liveEdits).length === 0) return committedRows;
    return committedRows.map((row) => {
      const patch = liveEdits[row.id];
      if (!patch) return row;
      const merged = { ...row, ...patch };
      return { ...merged, metrics: computeMetrics(merged, settings) };
    });
  }, [committedRows, liveEdits, settings]);

  const stats = useMemo(() => {
    const shortlisted = effectiveRows.filter((row) => row.status === "shortlisted").length;
    const clearingBar = effectiveRows.filter(
      (row) => row.metrics.marginPercent != null && row.metrics.marginPercent >= minMarginPercent,
    ).length;
    return { total: effectiveRows.length, shortlisted, clearingBar };
  }, [effectiveRows, minMarginPercent]);

  const filteredRows = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return effectiveRows.filter((row) => {
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
  }, [effectiveRows, filters.q, filters.status, filters.category, filters.minMargin]);

  function clearLiveEdit(rowId: string) {
    setLiveEdits((prev) => {
      if (!prev[rowId]) return prev;
      const { [rowId]: _removed, ...rest } = prev;
      return rest;
    });
  }

  function commitField(rowId: string, patch: Partial<ProductFields>) {
    setCommittedRows((prev) => {
      const index = prev.findIndex((row) => row.id === rowId);
      if (index === -1) return prev;
      if (!pendingSnapshots.current[rowId]) {
        pendingSnapshots.current[rowId] = prev[index];
      }
      const merged = { ...prev[index], ...patch };
      const next = [...prev];
      next[index] = { ...merged, metrics: computeMetrics(merged, settings) };
      return next;
    });
    clearLiveEdit(rowId);

    pendingPatches.current[rowId] = { ...pendingPatches.current[rowId], ...patch };
    if (saveTimers.current[rowId]) clearTimeout(saveTimers.current[rowId]);
    saveTimers.current[rowId] = setTimeout(() => void flushSave(rowId), 400);
  }

  async function flushSave(rowId: string) {
    const patch = pendingPatches.current[rowId];
    delete pendingPatches.current[rowId];
    delete saveTimers.current[rowId];
    const snapshot = pendingSnapshots.current[rowId];
    delete pendingSnapshots.current[rowId];
    if (!patch) return;

    const result = await updateProduct(rowId, patch);
    if (!result.ok) {
      toast.error(`Couldn't save changes: ${result.error}`);
      if (snapshot) {
        setCommittedRows((prev) => prev.map((row) => (row.id === rowId ? snapshot : row)));
      }
    }
  }

  function liveChangeNumber(rowId: string, field: keyof ProductFields, raw: string, toStored: (n: number) => number) {
    const parsed = Number.parseFloat(raw);
    setLiveEdits((prev) => ({
      ...prev,
      [rowId]: { ...prev[rowId], [field]: Number.isFinite(parsed) ? toStored(parsed) : null },
    }));
  }

  // Rebuilt every render (cheap: ~14 column defs) rather than memoized, so
  // every cell's closures (moveEdit, commitField...) are always current —
  // memoizing this against a narrow dep list risks stale closures over
  // tableRows, which is itself derived from columns further down.
  const columns = buildColumns({ minMarginPercent });

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

  function moveEdit(rowId: string, columnId: string, direction: MoveDirection) {
    const rowIdx = tableRows.findIndex((row) => row.original.id === rowId);
    if (direction === "down") {
      const target = tableRows[rowIdx + 1];
      if (target) {
        virtualizer.scrollToIndex(rowIdx + 1, { align: "auto" });
        setEditingCell({ rowId: target.original.id, columnId });
      } else {
        setEditingCell(null);
      }
      return;
    }

    const colIdx = EDITABLE_COLUMN_ORDER.indexOf(columnId as (typeof EDITABLE_COLUMN_ORDER)[number]);
    const nextColIdx = direction === "next" ? colIdx + 1 : colIdx - 1;
    if (nextColIdx >= 0 && nextColIdx < EDITABLE_COLUMN_ORDER.length) {
      setEditingCell({ rowId, columnId: EDITABLE_COLUMN_ORDER[nextColIdx] });
      return;
    }
    const targetRowIdx = direction === "next" ? rowIdx + 1 : rowIdx - 1;
    const targetRow = tableRows[targetRowIdx];
    if (targetRow) {
      virtualizer.scrollToIndex(targetRowIdx, { align: "auto" });
      setEditingCell({
        rowId: targetRow.original.id,
        columnId:
          direction === "next"
            ? EDITABLE_COLUMN_ORDER[0]
            : EDITABLE_COLUMN_ORDER[EDITABLE_COLUMN_ORDER.length - 1],
      });
    } else {
      setEditingCell(null);
    }
  }

  async function handleCreate() {
    const result = await createProduct();
    if (!result.ok) {
      toast.error(`Couldn't create product: ${result.error}`);
      return;
    }
    const newRow: ProductRow = {
      id: result.data.id,
      ...NEW_PRODUCT_DEFAULTS,
      metrics: computeMetrics(NEW_PRODUCT_DEFAULTS, settings),
    };
    setCommittedRows((prev) => [newRow, ...prev]);
    void setFilters({ q: "", status: [], category: "", minMargin: 0, sort: "", dir: "desc" });
    requestAnimationFrame(() => {
      virtualizer.scrollToIndex(0, { align: "start" });
      setEditingCell({ rowId: newRow.id, columnId: "name" });
    });
  }

  async function handleDuplicate(sourceId: string) {
    const source = committedRows.find((row) => row.id === sourceId);
    if (!source) return;
    const result = await duplicateProduct(sourceId);
    if (!result.ok) {
      toast.error(`Couldn't duplicate: ${result.error}`);
      return;
    }
    const fields: ProductFields = {
      name: `${source.name} (copy)`,
      category: source.category,
      sourceUrl: source.sourceUrl,
      costPriceAmount: source.costPriceAmount,
      costPriceCurrency: source.costPriceCurrency,
      deliveryDays: source.deliveryDays,
      targetPrice: source.targetPrice,
      competitorSoldCount: source.competitorSoldCount,
      status: source.status,
      notes: source.notes,
    };
    const newRow: ProductRow = {
      id: result.data.id,
      ...fields,
      metrics: computeMetrics(fields, settings),
    };
    setCommittedRows((prev) => [newRow, ...prev]);
    toast.success("Product duplicated");
  }

  async function handleDelete(row: ProductRow) {
    setCommittedRows((prev) => prev.filter((r) => r.id !== row.id));
    const result = await deleteProduct(row.id);
    if (!result.ok) {
      toast.error(`Couldn't delete: ${result.error}`);
      setCommittedRows((prev) => [row, ...prev]);
      return;
    }
    toast(`Deleted "${row.name}"`, {
      action: {
        label: "Undo",
        onClick: () => {
          setCommittedRows((prev) => [row, ...prev]);
          void restoreProduct({
            id: row.id,
            name: row.name,
            category: row.category,
            sourceUrl: row.sourceUrl,
            costPriceAmount: row.costPriceAmount,
            costPriceCurrency: row.costPriceCurrency,
            deliveryDays: row.deliveryDays,
            targetPrice: row.targetPrice,
            competitorSoldCount: row.competitorSoldCount,
            status: row.status,
            notes: row.notes,
          }).then((restoreResult) => {
            if (!restoreResult.ok) {
              toast.error("Couldn't restore product");
              setCommittedRows((prev) => prev.filter((r) => r.id !== row.id));
            }
          });
        },
      },
    });
  }

  function buildColumns({ minMarginPercent }: { minMarginPercent: number }) {
    function isEditing(rowId: string, columnId: string) {
      return editingCell?.rowId === rowId && editingCell.columnId === columnId;
    }

    return [
      columnHelper.group({
        id: "product",
        header: "Product information",
        columns: [
          columnHelper.accessor("name", {
            header: "Name",
            size: 320,
            cell: (info) => {
              const row = info.row.original;
              if (isEditing(row.id, "name")) {
                return (
                  <EditableInput
                    defaultValue={row.name}
                    onCommit={(value) => {
                      commitField(row.id, { name: value.trim() || row.name });
                      setEditingCell(null);
                    }}
                    onCancel={() => setEditingCell(null)}
                    onNavigate={(dir) => moveEdit(row.id, "name", dir)}
                  />
                );
              }
              return (
                <div
                  className="h-full w-full cursor-text"
                  onClick={() => setEditingCell({ rowId: row.id, columnId: "name" })}
                >
                  <TruncatedText value={row.name} />
                </div>
              );
            },
          }),
          columnHelper.accessor((row) => row.category ?? "—", {
            id: "category",
            header: "Category",
            size: 150,
            cell: (info) => {
              const row = info.row.original;
              if (isEditing(row.id, "category")) {
                return (
                  <EditableInput
                    defaultValue={row.category ?? ""}
                    list="category-options"
                    onCommit={(value) => {
                      commitField(row.id, { category: value.trim() || null });
                      setEditingCell(null);
                    }}
                    onCancel={() => setEditingCell(null)}
                    onNavigate={(dir) => moveEdit(row.id, "category", dir)}
                  />
                );
              }
              return (
                <div
                  className="h-full w-full cursor-text"
                  onClick={() => setEditingCell({ rowId: row.id, columnId: "category" })}
                >
                  <TruncatedText value={info.getValue()} muted />
                </div>
              );
            },
          }),
          columnHelper.accessor("sourceUrl", {
            header: "",
            size: 36,
            enableSorting: false,
            cell: (info) => {
              const row = info.row.original;
              const url = info.getValue();
              if (isEditing(row.id, "sourceUrl")) {
                return (
                  <EditableInput
                    defaultValue={url ?? ""}
                    onCommit={(value) => {
                      commitField(row.id, { sourceUrl: value.trim() || null });
                      setEditingCell(null);
                    }}
                    onCancel={() => setEditingCell(null)}
                    onNavigate={(dir) => moveEdit(row.id, "sourceUrl", dir)}
                  />
                );
              }
              return (
                <div
                  className="flex h-full w-full items-center justify-center"
                  onClick={() => setEditingCell({ rowId: row.id, columnId: "sourceUrl" })}
                >
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="text-ink-dim transition-colors hover:text-copper-bright"
                      aria-label="Open AliExpress listing"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </div>
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
            size: 116,
            cell: (info) => {
              const row = info.row.original;
              const editingAmount = isEditing(row.id, "costPriceAmount");
              return (
                <div className="flex h-full w-full items-center gap-1">
                  <div
                    className="h-full flex-1 cursor-text"
                    onClick={() =>
                      !editingAmount && setEditingCell({ rowId: row.id, columnId: "costPriceAmount" })
                    }
                  >
                    {editingAmount ? (
                      <EditableInput
                        type="number"
                        align="right"
                        defaultValue={String(fromPence(row.costPriceAmount))}
                        onLiveChange={(value) =>
                          liveChangeNumber(row.id, "costPriceAmount", value, (n) => toPence(n))
                        }
                        onCommit={(value) => {
                          const parsed = Number.parseFloat(value);
                          commitField(row.id, {
                            costPriceAmount: Number.isFinite(parsed) ? toPence(Math.max(parsed, 0)) : 0,
                          });
                          setEditingCell(null);
                        }}
                        onCancel={() => {
                          clearLiveEdit(row.id);
                          setEditingCell(null);
                        }}
                        onNavigate={(dir) => moveEdit(row.id, "costPriceAmount", dir)}
                      />
                    ) : (
                      <NumericCell>{formatGBP(row.metrics.costPriceGBP)}</NumericCell>
                    )}
                  </div>
                  <select
                    value={row.costPriceCurrency}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      commitField(row.id, {
                        costPriceCurrency: event.target.value as (typeof CURRENCIES)[number],
                      })
                    }
                    className="shrink-0 rounded-sm bg-transparent text-[10px] text-ink-faint outline-none"
                    aria-label="Cost price currency"
                  >
                    {CURRENCIES.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </div>
              );
            },
          }),
          columnHelper.accessor("deliveryDays", {
            header: "Days",
            size: 64,
            cell: (info) => {
              const row = info.row.original;
              if (isEditing(row.id, "deliveryDays")) {
                return (
                  <EditableInput
                    type="number"
                    align="right"
                    defaultValue={row.deliveryDays == null ? "" : String(row.deliveryDays)}
                    onLiveChange={(value) => liveChangeNumber(row.id, "deliveryDays", value, (n) => Math.round(n))}
                    onCommit={(value) => {
                      const parsed = Number.parseInt(value, 10);
                      commitField(row.id, { deliveryDays: Number.isFinite(parsed) ? Math.max(parsed, 0) : null });
                      setEditingCell(null);
                    }}
                    onCancel={() => {
                      clearLiveEdit(row.id);
                      setEditingCell(null);
                    }}
                    onNavigate={(dir) => moveEdit(row.id, "deliveryDays", dir)}
                  />
                );
              }
              return (
                <div
                  className="h-full w-full cursor-text"
                  onClick={() => setEditingCell({ rowId: row.id, columnId: "deliveryDays" })}
                >
                  <NumericCell>{info.getValue() ?? "—"}</NumericCell>
                </div>
              );
            },
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
            cell: (info) => {
              const row = info.row.original;
              if (isEditing(row.id, "targetPrice")) {
                return (
                  <EditableInput
                    type="number"
                    align="right"
                    defaultValue={String(fromPence(row.targetPrice))}
                    onLiveChange={(value) => liveChangeNumber(row.id, "targetPrice", value, (n) => toPence(n))}
                    onCommit={(value) => {
                      const parsed = Number.parseFloat(value);
                      commitField(row.id, {
                        targetPrice: Number.isFinite(parsed) ? toPence(Math.max(parsed, 0)) : 0,
                      });
                      setEditingCell(null);
                    }}
                    onCancel={() => {
                      clearLiveEdit(row.id);
                      setEditingCell(null);
                    }}
                    onNavigate={(dir) => moveEdit(row.id, "targetPrice", dir)}
                  />
                );
              }
              return (
                <div
                  className="h-full w-full cursor-text"
                  onClick={() => setEditingCell({ rowId: row.id, columnId: "targetPrice" })}
                >
                  <NumericCell>{formatGBP(info.getValue())}</NumericCell>
                </div>
              );
            },
          }),
          columnHelper.accessor("competitorSoldCount", {
            header: "Sold",
            size: 80,
            sortingFn: (rowA, rowB) =>
              compareNullable(rowA.original.competitorSoldCount, rowB.original.competitorSoldCount),
            cell: (info) => {
              const row = info.row.original;
              if (isEditing(row.id, "competitorSoldCount")) {
                return (
                  <EditableInput
                    type="number"
                    align="right"
                    defaultValue={row.competitorSoldCount == null ? "" : String(row.competitorSoldCount)}
                    onCommit={(value) => {
                      const parsed = Number.parseInt(value, 10);
                      commitField(row.id, {
                        competitorSoldCount: Number.isFinite(parsed) ? Math.max(parsed, 0) : null,
                      });
                      setEditingCell(null);
                    }}
                    onCancel={() => setEditingCell(null)}
                    onNavigate={(dir) => moveEdit(row.id, "competitorSoldCount", dir)}
                  />
                );
              }
              return (
                <div
                  className="h-full w-full cursor-text"
                  onClick={() => setEditingCell({ rowId: row.id, columnId: "competitorSoldCount" })}
                >
                  <NumericCell>{info.getValue() ?? "—"}</NumericCell>
                </div>
              );
            },
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
            cell: (info) => {
              const row = info.row.original;
              if (isEditing(row.id, "status")) {
                return (
                  <EditableSelect
                    value={row.status}
                    options={PRODUCT_STATUSES}
                    labelFor={(s) => s.charAt(0).toUpperCase() + s.slice(1)}
                    onCommit={(value) => {
                      commitField(row.id, { status: value });
                      setEditingCell(null);
                    }}
                  />
                );
              }
              return (
                <div
                  className="h-full w-full cursor-pointer"
                  onClick={() => setEditingCell({ rowId: row.id, columnId: "status" })}
                >
                  <StatusBadge status={info.getValue()} />
                </div>
              );
            },
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
            cell: (info) => {
              const row = info.row.original;
              if (isEditing(row.id, "notes")) {
                return (
                  <EditableInput
                    defaultValue={row.notes ?? ""}
                    onCommit={(value) => {
                      commitField(row.id, { notes: value.trim() || null });
                      setEditingCell(null);
                    }}
                    onCancel={() => setEditingCell(null)}
                    onNavigate={(dir) => moveEdit(row.id, "notes", dir)}
                  />
                );
              }
              return (
                <div
                  className="h-full w-full cursor-text"
                  onClick={() => setEditingCell({ rowId: row.id, columnId: "notes" })}
                >
                  <TruncatedText value={info.getValue()} muted />
                </div>
              );
            },
          }),
        ],
      }),
      columnHelper.group({
        id: "actions",
        header: "",
        columns: [
          columnHelper.display({
            id: "actions",
            size: 64,
            cell: (info) => (
              <RowActions
                row={info.row.original}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            ),
          }),
        ],
      }),
    ];
  }

  const totalWidth = table.getTotalSize();
  const headerGroups = table.getHeaderGroups();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <datalist id="category-options">
        {categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>
      <PipelineToolbar
        categories={categories}
        filters={filters}
        setFilters={(partial) => void setFilters(partial)}
        searchInputRef={searchInputRef}
        shownCount={filteredRows.length}
        totalCount={effectiveRows.length}
        onCreate={() => void handleCreate()}
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
                    header.column.id === "actions" && "sticky right-0 z-6 bg-surface",
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
                  className="group absolute left-0 flex w-full border-b border-hairline/60 hover:bg-raised"
                  style={{ top: virtualRow.start, height: virtualRow.size }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className={cn(
                        "flex items-center overflow-hidden border-r border-hairline/40 text-sm text-ink",
                        cell.column.id === "actions"
                          ? "sticky right-0 z-5 bg-surface px-1.5 group-hover:bg-raised"
                          : "px-2",
                      )}
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
