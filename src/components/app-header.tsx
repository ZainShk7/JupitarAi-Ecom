import Link from "next/link";
import { SettingsDrawer } from "@/components/settings/settings-drawer";
import { cn } from "@/lib/utils";

export function AppHeader({ active }: { active: "pipeline" | "import" | "dashboard" }) {
  return (
    <header className="flex items-center gap-5 border-b border-hairline bg-surface px-4 py-2.5">
      <span className="font-display text-sm font-semibold tracking-wide text-ink">
        JUPITAR ECOM
      </span>
      <nav className="flex items-center gap-4 text-xs uppercase tracking-wide">
        <Link
          href="/"
          className={cn(
            "transition-colors",
            active === "pipeline" ? "text-copper-bright" : "text-ink-dim hover:text-ink",
          )}
        >
          Pipeline
        </Link>
        <Link
          href="/dashboard"
          className={cn(
            "transition-colors",
            active === "dashboard" ? "text-copper-bright" : "text-ink-dim hover:text-ink",
          )}
        >
          Dashboard
        </Link>
        <Link
          href="/import"
          className={cn(
            "transition-colors",
            active === "import" ? "text-copper-bright" : "text-ink-dim hover:text-ink",
          )}
        >
          Import / Export
        </Link>
      </nav>
      <div className="ml-auto">
        <SettingsDrawer />
      </div>
    </header>
  );
}
