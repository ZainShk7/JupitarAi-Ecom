import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products, type ProductStatus } from "@/db/schema";
import { computeMetrics, type ProductMetrics, type SettingsInput } from "@/lib/metrics";
import type { CurrencyCode } from "@/lib/money";
import { getSettings } from "@/lib/settings";

export const PAGE_SIZE = 100;

export interface ProductRow {
  id: string;
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

type RawProduct = typeof products.$inferSelect;

/**
 * The full product table fits easily in memory (a few thousand rows, well
 * under a MB) but a single `select *` against this Neon project's compute
 * takes 15-20s regardless of driver — the bottleneck is server-side query
 * execution, not payload size or our code. Paying that cost once per process
 * and serving every read (list, filter, sort, page) from memory afterward is
 * the fix; mutations patch this array in place instead of invalidating it,
 * so an active edit session never re-triggers the slow fetch.
 */
let rawCache: RawProduct[] | null = null;
let rawCachePromise: Promise<RawProduct[]> | null = null;

async function loadRawProducts(): Promise<RawProduct[]> {
  if (rawCache) return rawCache;
  if (!rawCachePromise) {
    rawCachePromise = db
      .select()
      .from(products)
      .then((rows) => {
        rawCache = rows;
        rawCachePromise = null;
        return rows;
      })
      .catch((error) => {
        rawCachePromise = null;
        throw error;
      });
  }
  return rawCachePromise;
}

export function cacheInsertProduct(row: RawProduct): void {
  if (rawCache) rawCache = [row, ...rawCache];
}

export function cacheUpdateProduct(row: RawProduct): void {
  if (rawCache) rawCache = rawCache.map((r) => (r.id === row.id ? row : r));
}

export function cacheDeleteProduct(id: string): void {
  if (rawCache) rawCache = rawCache.filter((r) => r.id !== id);
}

function toProductRow(product: RawProduct, settings: SettingsInput): ProductRow {
  const costPriceCurrency = product.costPriceCurrency as CurrencyCode;
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    sourceUrl: product.sourceUrl,
    costPriceAmount: product.costPriceAmount,
    costPriceCurrency,
    deliveryDays: product.deliveryDays,
    targetPrice: product.targetPrice,
    competitorSoldCount: product.competitorSoldCount,
    status: product.status,
    notes: product.notes,
    metrics: computeMetrics(
      {
        costPriceAmount: product.costPriceAmount,
        costPriceCurrency,
        targetPrice: product.targetPrice,
        deliveryDays: product.deliveryDays,
        competitorSoldCount: product.competitorSoldCount,
      },
      settings,
    ),
  };
}

async function getAllRows(): Promise<{ rows: ProductRow[]; settings: SettingsInput }> {
  const [rawRows, settings] = await Promise.all([loadRawProducts(), getSettings()]);
  return { rows: rawRows.map((row) => toProductRow(row, settings)), settings };
}

/** Full computed dataset, unpaginated — for the dashboard's aggregate charts. */
export async function getDashboardRows(): Promise<ProductRow[]> {
  const { rows } = await getAllRows();
  return rows;
}

export async function getProductById(id: string): Promise<ProductRow | null> {
  const [productRow, settings] = await Promise.all([
    db.select().from(products).where(eq(products.id, id)).limit(1),
    getSettings(),
  ]);
  const product = productRow[0];
  if (!product) return null;
  return toProductRow(product, settings);
}

function getSortValue(row: ProductRow, sortId: string): string | number | null {
  switch (sortId) {
    case "name":
      return row.name;
    case "category":
      return row.category ?? "";
    case "costPriceGBP":
      return row.metrics.costPriceGBP;
    case "deliveryDays":
      return row.deliveryDays;
    case "targetPrice":
      return row.targetPrice;
    case "competitorSoldCount":
      return row.competitorSoldCount;
    case "fees":
      return row.metrics.fees;
    case "totalCost":
      return row.metrics.totalCost;
    case "marginPercent":
      return row.metrics.marginPercent;
    case "roiPercent":
      return row.metrics.roiPercent;
    case "status":
      return row.status;
    case "verdict":
      return row.metrics.verdictScore;
    case "notes":
      return row.notes ?? "";
    default:
      return null;
  }
}

function sortRows(rows: ProductRow[], sortId: string, dir: "asc" | "desc"): ProductRow[] {
  const sorted = [...rows].sort((a, b) => {
    const av = getSortValue(a, sortId);
    const bv = getSortValue(b, sortId);
    // Nulls always sort last, independent of direction — only the relative
    // order of two non-null values flips with `dir`.
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return dir === "desc" ? -cmp : cmp;
  });
  return sorted;
}

export interface PipelineQuery {
  page: number;
  q: string;
  status: ProductStatus[];
  category: string;
  minMargin: number;
  sort: string;
  dir: "asc" | "desc";
}

export interface PipelinePage {
  rows: ProductRow[];
  categories: string[];
  settings: SettingsInput;
  page: number;
  pageSize: number;
  totalPages: number;
  filteredCount: number;
  grandTotal: number;
  shortlisted: number;
  clearingBar: number;
}

export async function getPipelineData(query: PipelineQuery): Promise<PipelinePage> {
  const { rows, settings } = await getAllRows();

  const categories = Array.from(
    new Set(rows.map((row) => row.category).filter((category): category is string => Boolean(category))),
  ).sort((a, b) => a.localeCompare(b));

  const grandTotal = rows.length;
  const shortlisted = rows.filter((row) => row.status === "shortlisted").length;
  const clearingBar = rows.filter(
    (row) => row.metrics.marginPercent != null && row.metrics.marginPercent >= settings.minMarginPercent,
  ).length;

  const q = query.q.trim().toLowerCase();
  let filtered = rows.filter((row) => {
    if (query.status.length > 0 && !query.status.includes(row.status)) return false;
    if (query.category && row.category !== query.category) return false;
    if (query.minMargin > 0) {
      if (row.metrics.marginPercent == null || row.metrics.marginPercent < query.minMargin) return false;
    }
    if (q) {
      const haystack = `${row.name} ${row.category ?? ""} ${row.notes ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  if (query.sort) {
    filtered = sortRows(filtered, query.sort, query.dir);
  }

  const filteredCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const page = Math.min(Math.max(query.page, 1), totalPages);
  const start = (page - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  return {
    rows: pageRows,
    categories,
    settings,
    page,
    pageSize: PAGE_SIZE,
    totalPages,
    filteredCount,
    grandTotal,
    shortlisted,
    clearingBar,
  };
}
