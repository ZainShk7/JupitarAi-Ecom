import { cn } from "@/lib/utils";
import type { ProductStatus } from "@/lib/product-status";

// Status is a workflow stage, not a financial verdict — it gets its own,
// deliberately different color language (a metallic progression) so it's
// never confused with the verdict badge's good/warn/oxblood semantics.
const STATUS_META: Record<ProductStatus, { label: string; className: string }> = {
  researching: { label: "Researching", className: "text-ink-dim" },
  shortlisted: { label: "Shortlisted", className: "text-copper" },
  listed: { label: "Listed", className: "text-copper-bright" },
  winner: { label: "Winner", className: "text-good" },
  rejected: { label: "Rejected", className: "text-ink-faint" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: ProductStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide",
        meta.className,
        className,
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}
