"use client";

import type { RefObject } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { PRODUCT_STATUSES, type ProductStatus } from "@/lib/product-status";
import { StatusBadge } from "./status-badge";

export interface PipelineFilters {
  q: string;
  status: ProductStatus[];
  category: string;
  minMargin: number;
}

export function PipelineToolbar({
  categories,
  filters,
  setFilters,
  searchInputRef,
  shownCount,
  totalCount,
  onCreate,
}: {
  categories: string[];
  filters: PipelineFilters;
  setFilters: (partial: Partial<PipelineFilters>) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  shownCount: number;
  totalCount: number;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-hairline bg-surface px-4 py-3">
      <div className="relative w-64">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
        <Input
          ref={searchInputRef}
          value={filters.q}
          onChange={(event) => setFilters({ q: event.target.value })}
          placeholder="Search products…  (/)"
          className="h-8 pl-8 text-sm"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            Status{filters.status.length ? ` (${filters.status.length})` : ""}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {PRODUCT_STATUSES.map((status) => (
            <DropdownMenuCheckboxItem
              key={status}
              checked={filters.status.includes(status)}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(checked) => {
                setFilters({
                  status: checked
                    ? [...filters.status, status]
                    : filters.status.filter((value) => value !== status),
                });
              }}
            >
              <StatusBadge status={status} />
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Select
        value={filters.category || "all"}
        onValueChange={(value) => setFilters({ category: value === "all" ? "" : value })}
      >
        <SelectTrigger size="sm" className="h-8 w-44" aria-label="Filter by category">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category} value={category}>
              {category}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <span className="text-[11px] whitespace-nowrap uppercase tracking-wide text-ink-dim">
          Min margin
        </span>
        <Slider
          value={[filters.minMargin]}
          onValueChange={([value]) => setFilters({ minMargin: value })}
          max={100}
          step={1}
          className="w-28"
          thumbLabel="Minimum margin percent"
        />
        <span className="w-9 shrink-0 text-xs tabular text-ink-dim">{filters.minMargin}%</span>
      </div>

      <Button variant="default" size="sm" className="h-8" onClick={onCreate}>
        <Plus className="size-3.5" />
        New product
        <span className="text-primary-foreground/95">(n)</span>
      </Button>

      <div className="ml-auto shrink-0 text-xs text-ink-faint">
        Showing {shownCount.toLocaleString()} of {totalCount.toLocaleString()}
      </div>
    </div>
  );
}
