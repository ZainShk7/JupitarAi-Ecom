"use client";

import { useMemo, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { importProducts } from "@/lib/actions";
import {
  autoMapColumn,
  buildImportRow,
  decodeFileText,
  MAPPABLE_FIELD_LABELS,
  parseCsvRows,
  splitHeaderAndData,
  type ColumnMapping,
  type MappableField,
  type ParsedImportRow,
} from "@/lib/csv";
import { CURRENCIES, type CurrencyCode } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MAX_PREVIEW_ROWS = 50;
const MAX_ERROR_ROWS_SHOWN = 200;

interface ParsedFile {
  fileName: string;
  fieldHeaders: string[];
  dataRows: string[][];
}

export function ImportWizard() {
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [costCurrency, setCostCurrency] = useState<CurrencyCode>("GBP");
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please choose a .csv file");
      return;
    }
    const text = await decodeFileText(file);
    const rows = parseCsvRows(text);
    const { fieldHeaders, dataRows } = splitHeaderAndData(rows);
    if (fieldHeaders.length === 0) {
      toast.error("Couldn't find a header row in that file");
      return;
    }
    setParsedFile({ fileName: file.name, fieldHeaders, dataRows });
    setMapping(fieldHeaders.map((header) => autoMapColumn(header)));
    setResult(null);
  }

  const parsedRows: ParsedImportRow[] = useMemo(() => {
    if (!parsedFile) return [];
    return parsedFile.dataRows.map((cells, index) =>
      buildImportRow(cells, mapping, index + 1, costCurrency),
    );
  }, [parsedFile, mapping, costCurrency]);

  const validRows = parsedRows.filter((row) => row.fields != null);
  const errorRows = parsedRows.filter((row) => row.fields == null);
  const costPriceMapped = mapping.includes("costPriceAmount");

  async function handleImport() {
    setImporting(true);
    try {
      const result = await importProducts(validRows.map((row) => row.fields));
      if (!result.ok) {
        toast.error(`Import failed: ${result.error}`);
        return;
      }
      setResult(result.data);
      if (result.data.failed === 0) {
        toast.success(
          `Imported ${result.data.imported} product${result.data.imported === 1 ? "" : "s"}`,
        );
      }
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setParsedFile(null);
    setMapping([]);
    setResult(null);
  }

  if (result) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-lg text-ink">
          Imported <span className="text-good">{result.imported}</span> product
          {result.imported === 1 ? "" : "s"}
          {result.failed > 0 ? (
            <>
              {" "}
              · <span className="text-bad-text">{result.failed}</span> failed
            </>
          ) : null}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reset}>
            Import another file
          </Button>
          <Button asChild>
            <Link href="/">Back to pipeline</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!parsedFile) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            const file = event.dataTransfer.files[0];
            if (file) void handleFile(file);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex h-64 w-full max-w-lg cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-colors",
            isDragging ? "border-copper bg-raised" : "border-hairline hover:border-edge",
          )}
        >
          <UploadCloud className="size-8 text-ink-dim" />
          <p className="text-sm text-ink">Drop your spreadsheet CSV here</p>
          <p className="text-xs text-ink-faint">or click to browse — .csv only</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-ink">{parsedFile.fileName}</p>
          <p className="text-xs text-ink-faint">
            {parsedFile.dataRows.length} row{parsedFile.dataRows.length === 1 ? "" : "s"} found
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reset}>
          Choose a different file
        </Button>
      </div>

      <div className="mb-4 rounded-lg border border-hairline bg-surface">
        <div className="border-b border-hairline px-4 py-2 text-[11px] uppercase tracking-wide text-ink-dim">
          Column mapping
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>CSV column</TableHead>
              <TableHead>Maps to</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parsedFile.fieldHeaders.map((header, index) => (
              <TableRow key={index}>
                <TableCell className="text-ink-dim">{header || `Column ${index + 1}`}</TableCell>
                <TableCell>
                  <Select
                    value={mapping[index] ?? "ignore"}
                    onValueChange={(value) =>
                      setMapping((prev) => {
                        const next = [...prev];
                        next[index] = value as ColumnMapping;
                        return next;
                      })
                    }
                  >
                    <SelectTrigger
                      size="sm"
                      className="w-56"
                      aria-label={`Map column "${header || `Column ${index + 1}`}" to field`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ignore">Ignore</SelectItem>
                      {(Object.keys(MAPPABLE_FIELD_LABELS) as MappableField[]).map((field) => (
                        <SelectItem key={field} value={field}>
                          {MAPPABLE_FIELD_LABELS[field]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {costPriceMapped ? (
          <div className="flex items-center gap-2 border-t border-hairline px-4 py-2.5">
            <span className="text-xs text-ink-dim">Cost price column is in</span>
            <Select value={costCurrency} onValueChange={(value) => setCostCurrency(value as CurrencyCode)}>
              <SelectTrigger size="sm" className="w-24" aria-label="Cost price currency">
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
            <span className="text-xs text-ink-faint">
              (the spreadsheet doesn&apos;t record currency per row)
            </span>
          </div>
        ) : null}
      </div>

      <div className="mb-3 flex items-center gap-4 text-sm">
        <span className="text-good">{validRows.length} ready to import</span>
        {errorRows.length > 0 ? <span className="text-bad-text">{errorRows.length} with errors</span> : null}
        <Button
          size="sm"
          className="ml-auto"
          disabled={validRows.length === 0 || importing}
          onClick={() => void handleImport()}
        >
          {importing ? "Importing…" : `Import ${validRows.length} product${validRows.length === 1 ? "" : "s"}`}
        </Button>
      </div>

      {errorRows.length > 0 ? (
        <div className="mb-4 rounded-lg border border-bad/40 bg-surface">
          <div className="border-b border-hairline px-4 py-2 text-[11px] uppercase tracking-wide text-bad-text">
            Rows with errors — not imported
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Row</TableHead>
                <TableHead>Name (as read)</TableHead>
                <TableHead>Errors</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errorRows.slice(0, MAX_ERROR_ROWS_SHOWN).map((row) => (
                <TableRow key={row.rowNumber}>
                  <TableCell className="tabular text-ink-dim">{row.rowNumber}</TableCell>
                  <TableCell className="max-w-64 truncate text-ink-dim">
                    {row.raw[mapping.indexOf("name")] || "—"}
                  </TableCell>
                  <TableCell className="text-bad-text">{row.errors.join("; ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {errorRows.length > MAX_ERROR_ROWS_SHOWN ? (
            <p className="px-4 py-2 text-xs text-ink-faint">
              +{errorRows.length - MAX_ERROR_ROWS_SHOWN} more error rows not shown
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-lg border border-hairline bg-surface">
        <div className="border-b border-hairline px-4 py-2 text-[11px] uppercase tracking-wide text-ink-dim">
          Preview{validRows.length > MAX_PREVIEW_ROWS ? ` (first ${MAX_PREVIEW_ROWS})` : ""}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Target</TableHead>
              <TableHead className="text-right">Days</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {validRows.slice(0, MAX_PREVIEW_ROWS).map((row) => (
              <TableRow key={row.rowNumber}>
                <TableCell className="max-w-64 truncate">{row.fields?.name}</TableCell>
                <TableCell className="text-ink-dim">{row.fields?.category ?? "—"}</TableCell>
                <TableCell className="tabular text-right">
                  {((row.fields?.costPriceAmount ?? 0) / 100).toFixed(2)} {row.fields?.costPriceCurrency}
                </TableCell>
                <TableCell className="tabular text-right">
                  £{((row.fields?.targetPrice ?? 0) / 100).toFixed(2)}
                </TableCell>
                <TableCell className="tabular text-right">{row.fields?.deliveryDays ?? "—"}</TableCell>
                <TableCell className="text-ink-dim capitalize">{row.fields?.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
