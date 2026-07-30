"use client";

import { Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProductRow } from "@/lib/products";

export function RowActions({
  row,
  onDuplicate,
  onDelete,
}: {
  row: ProductRow;
  onDuplicate: (id: string) => void;
  onDelete: (row: ProductRow) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Duplicate product"
        onClick={() => onDuplicate(row.id)}
      >
        <Copy className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Delete product"
        onClick={() => onDelete(row)}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
