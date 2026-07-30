import Papa from "papaparse";
import { type CurrencyCode, formatGBP, formatPercent, fromPence } from "@/lib/money";
import type { ProductMetrics } from "@/lib/metrics";
import { productFieldsSchema, type ProductFields } from "@/lib/product-schema";
import { PRODUCT_STATUSES, type ProductStatus } from "@/lib/product-status";

// ---------------------------------------------------------------------------
// Reading: encoding, parsing, header detection
// ---------------------------------------------------------------------------

/** Old Excel exports on Windows are frequently windows-1252 (a superset of
 * ISO-8859-1), not UTF-8. Decode strictly as UTF-8 first; fall back if it's
 * not valid UTF-8 rather than silently mangling characters. */
export async function decodeFileText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

export function parseCsvRows(text: string): string[][] {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
  return result.data;
}

const GROUP_HEADER_MARKERS = [
  "product information",
  "aliexpress metrics",
  "ebay market metrics",
  "decision status",
];

function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .replace(/[%().&]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeGroupHeaderRow(cells: string[]): boolean {
  return cells.some((cell) => {
    const normalized = normalizeHeader(cell);
    return GROUP_HEADER_MARKERS.some((marker) => normalized.includes(marker));
  });
}

/** Splits parsed CSV rows into the field-header row and data rows, skipping
 * the group-label row (e.g. "PRODUCT INFORMATION,,,ALIEXPRESS METRICS,...")
 * if this file has one — matching the two-row-header spreadsheet template. */
export function splitHeaderAndData(rows: string[][]): {
  fieldHeaders: string[];
  dataRows: string[][];
} {
  if (rows.length === 0) return { fieldHeaders: [], dataRows: [] };
  if (looksLikeGroupHeaderRow(rows[0])) {
    return { fieldHeaders: rows[1] ?? [], dataRows: rows.slice(2) };
  }
  return { fieldHeaders: rows[0], dataRows: rows.slice(1) };
}

// ---------------------------------------------------------------------------
// Column auto-mapping
// ---------------------------------------------------------------------------

export type MappableField = keyof Omit<ProductFields, "costPriceCurrency">;
export type ColumnMapping = MappableField | "ignore";

export const MAPPABLE_FIELD_LABELS: Record<MappableField, string> = {
  name: "Product Name",
  category: "Category",
  sourceUrl: "AliExpress URL",
  costPriceAmount: "Cost Price",
  deliveryDays: "Delivery Days",
  targetPrice: "Target Price",
  competitorSoldCount: "Competitor Sold Count",
  status: "Status",
  notes: "Notes",
};

const FIELD_LABEL_CANDIDATES: Record<MappableField, string[]> = {
  name: ["product name", "name"],
  category: ["category"],
  sourceUrl: ["aliexpress url", "source url", "url", "product url"],
  costPriceAmount: ["cost price gbp", "cost price", "cost"],
  deliveryDays: ["est delivery days", "estimated delivery days", "delivery days", "delivery"],
  targetPrice: ["target selling price gbp", "target selling price", "target price"],
  competitorSoldCount: ["competitor sold count", "sold count", "sold"],
  status: ["status"],
  notes: ["notes"],
};

// Derived columns in the spreadsheet (fees, total cost, margin, ROI) are
// never mapped to a field — their values are always recomputed, never read.
const DERIVED_HEADER_MARKERS = ["ebay fees", "total product cost", "profit margin", "roi"];

export function autoMapColumn(header: string): ColumnMapping {
  const normalized = normalizeHeader(header);
  if (!normalized) return "ignore";
  if (DERIVED_HEADER_MARKERS.some((marker) => normalized.includes(marker))) return "ignore";

  for (const [field, candidates] of Object.entries(FIELD_LABEL_CANDIDATES) as [
    MappableField,
    string[],
  ][]) {
    if (candidates.includes(normalized)) return field;
  }
  for (const [field, candidates] of Object.entries(FIELD_LABEL_CANDIDATES) as [
    MappableField,
    string[],
  ][]) {
    if (candidates.some((c) => normalized.includes(c) || c.includes(normalized))) return field;
  }
  return "ignore";
}

// ---------------------------------------------------------------------------
// Cell cleaning
// ---------------------------------------------------------------------------

const ERROR_CELL_PATTERN = /^#(REF|DIV\/0|N\/A|VALUE|NAME\?|NULL)!?$/i;

/** Strips £/$/€ prefixes and thousands separators; #REF!/#DIV/0!/blank -> null. */
export function cleanNumberCell(raw: string | undefined): number | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed === "" || ERROR_CELL_PATTERN.test(trimmed)) return null;
  const cleaned = trimmed.replace(/[£$€]/g, "").replace(/,/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function cleanTextCell(raw: string | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

function cleanStatusCell(raw: string | undefined): ProductStatus {
  const trimmed = (raw ?? "").trim().toLowerCase();
  return (PRODUCT_STATUSES as readonly string[]).includes(trimmed)
    ? (trimmed as ProductStatus)
    : "researching";
}

// ---------------------------------------------------------------------------
// Row building — raw CSV cells + column mapping -> validated ProductFields
// ---------------------------------------------------------------------------

export interface ParsedImportRow {
  rowNumber: number; // 1-based, matching the CSV's data rows for display
  raw: string[];
  fields: ProductFields | null;
  errors: string[];
}

export function buildImportRow(
  cells: string[],
  mapping: ColumnMapping[],
  rowNumber: number,
  defaultCurrency: CurrencyCode,
): ParsedImportRow {
  const draft: Record<string, unknown> = {
    costPriceCurrency: defaultCurrency,
    status: "researching",
    category: null,
    sourceUrl: null,
    deliveryDays: null,
    competitorSoldCount: null,
    notes: null,
  };

  for (let i = 0; i < mapping.length; i++) {
    const field = mapping[i];
    if (field === "ignore") continue;
    const raw = cells[i];
    switch (field) {
      case "name":
      case "category":
      case "sourceUrl":
      case "notes":
        draft[field] = cleanTextCell(raw);
        break;
      case "costPriceAmount":
      case "targetPrice": {
        const value = cleanNumberCell(raw);
        if (value != null) draft[field] = Math.round(value * 100);
        break;
      }
      case "deliveryDays":
      case "competitorSoldCount": {
        const value = cleanNumberCell(raw);
        draft[field] = value == null ? null : Math.round(value);
        break;
      }
      case "status":
        draft.status = cleanStatusCell(raw);
        break;
    }
  }

  const parsed = productFieldsSchema.safeParse(draft);
  if (parsed.success) {
    return { rowNumber, raw: cells, fields: parsed.data, errors: [] };
  }
  return {
    rowNumber,
    raw: cells,
    fields: null,
    errors: parsed.error.issues.map((issue) => `${String(issue.path[0] ?? "row")}: ${issue.message}`),
  };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export interface ExportableRow {
  name: string;
  category: string | null;
  sourceUrl: string | null;
  costPriceAmount: number;
  costPriceCurrency: CurrencyCode;
  deliveryDays: number | null;
  targetPrice: number;
  competitorSoldCount: number | null;
  status: ProductStatus;
  notes: string | null;
  metrics: ProductMetrics;
}

/** Same two-row-header layout as the original template — every derived
 * column is recomputed fresh, never copied from stored values. */
export function buildTemplateCsv(rows: ExportableRow[]): string {
  const groupHeader = [
    "PRODUCT INFORMATION",
    "",
    "",
    "ALIEXPRESS METRICS",
    "",
    "EBAY MARKET METRICS",
    "",
    "",
    "",
    "",
    "",
    "DECISION & STATUS",
    "",
  ];
  const fieldHeader = [
    "Product Name",
    "Category",
    "AliExpress URL",
    "Cost Price (GBP)",
    "Est. Delivery (Days)",
    "Target Selling Price (GBP)",
    "Competitor Sold Count",
    "Estimated eBay Fees (GBP)",
    "Total Product Cost (GBP)",
    "Profit Margin %",
    "ROI %",
    "Status",
    "Notes",
  ];
  const body = rows.map((row) => [
    row.name,
    row.category ?? "",
    row.sourceUrl ?? "",
    formatGBP(row.metrics.costPriceGBP),
    row.deliveryDays ?? "",
    formatGBP(row.targetPrice),
    row.competitorSoldCount ?? "",
    formatGBP(row.metrics.fees),
    formatGBP(row.metrics.totalCost),
    formatPercent(row.metrics.marginPercent),
    formatPercent(row.metrics.roiPercent),
    row.status.charAt(0).toUpperCase() + row.status.slice(1),
    row.notes ?? "",
  ]);
  return Papa.unparse([groupHeader, fieldHeader, ...body]);
}

/** A single flat header row with every field, including original currency —
 * a complete, lossless export rather than a legacy-template match. */
export function buildFlatCsv(rows: ExportableRow[]): string {
  const header = [
    "Name",
    "Category",
    "Source URL",
    "Cost Price Amount",
    "Cost Price Currency",
    "Cost Price (GBP)",
    "Delivery Days",
    "Target Price (GBP)",
    "Competitor Sold Count",
    "Fees (GBP)",
    "Total Cost (GBP)",
    "Margin %",
    "ROI %",
    "Verdict",
    "Status",
    "Notes",
  ];
  const body = rows.map((row) => [
    row.name,
    row.category ?? "",
    row.sourceUrl ?? "",
    fromPence(row.costPriceAmount),
    row.costPriceCurrency,
    fromPence(row.metrics.costPriceGBP),
    row.deliveryDays ?? "",
    fromPence(row.targetPrice),
    row.competitorSoldCount ?? "",
    fromPence(row.metrics.fees),
    fromPence(row.metrics.totalCost),
    row.metrics.marginPercent == null ? "" : row.metrics.marginPercent.toFixed(1),
    row.metrics.roiPercent == null ? "" : row.metrics.roiPercent.toFixed(1),
    row.metrics.verdict,
    row.status,
    row.notes ?? "",
  ]);
  return Papa.unparse([header, ...body]);
}

export function downloadCsv(filename: string, csv: string) {
  // A BOM keeps Excel from mis-detecting encoding on re-open.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
