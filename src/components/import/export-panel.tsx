"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildFlatCsv, buildTemplateCsv, downloadCsv, type ExportableRow } from "@/lib/csv";

export function ExportPanel({ rows }: { rows: ExportableRow[] }) {
  return (
    <div className="flex items-center gap-3 border-b border-hairline bg-surface px-4 py-3">
      <span className="text-sm text-ink">Export all {rows.length.toLocaleString()} products</span>
      <Button
        variant="outline"
        size="sm"
        className="ml-auto"
        onClick={() => downloadCsv("jupitar-ecom-export.csv", buildTemplateCsv(rows))}
      >
        <Download className="size-3.5" />
        Spreadsheet format
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => downloadCsv("jupitar-ecom-export-flat.csv", buildFlatCsv(rows))}
      >
        <Download className="size-3.5" />
        Flat CSV
      </Button>
    </div>
  );
}
