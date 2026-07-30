import { cn } from "@/lib/utils";
import type { Verdict } from "@/lib/metrics";

const VERDICT_META: Record<Verdict, { label: string; className: string }> = {
  strong: { label: "Strong", className: "text-good" },
  viable: { label: "Viable", className: "text-copper" },
  marginal: { label: "Marginal", className: "text-warn" },
  kill: { label: "Kill", className: "text-oxblood" },
};

export function VerdictBadge({
  verdict,
  className,
}: {
  verdict: Verdict;
  className?: string;
}) {
  const meta = VERDICT_META[verdict];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide",
        meta.className,
        className,
      )}
    >
      <span className="size-1.5 shrink-0 rounded-[1px] bg-current" />
      {meta.label}
    </span>
  );
}
