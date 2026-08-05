import Link from "next/link";
import { SettingsDrawer } from "@/components/settings/settings-drawer";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";

export function AppHeader({ active }: { active: "pipeline" | "import" | "dashboard" | "research" }) {
  return (
    <header className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-hairline bg-surface px-4 py-2.5">
      <span className="flex items-center gap-2 whitespace-nowrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark.png" alt="" width={24} height={24} className="size-6 rounded-md" />
        <span className="font-display text-sm font-semibold tracking-wide text-ink">JUPITAR ECOM</span>
      </span>
      <nav className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-wide">
        <Link
          href="/"
          className={cn(
            "whitespace-nowrap transition-colors",
            active === "pipeline" ? "text-copper-bright" : "text-ink-dim hover:text-ink",
          )}
        >
          Pipeline
        </Link>
        <Link
          href="/dashboard"
          className={cn(
            "whitespace-nowrap transition-colors",
            active === "dashboard" ? "text-copper-bright" : "text-ink-dim hover:text-ink",
          )}
        >
          Dashboard
        </Link>
        <Link
          href="/import"
          className={cn(
            "whitespace-nowrap transition-colors",
            active === "import" ? "text-copper-bright" : "text-ink-dim hover:text-ink",
          )}
        >
          Import
        </Link>
        <Link
          href="/research"
          className={cn(
            "whitespace-nowrap transition-colors",
            active === "research" ? "text-copper-bright" : "text-ink-dim hover:text-ink",
          )}
        >
          Research
        </Link>
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <UserMenu />
        <ThemeToggle />
        <SettingsDrawer />
      </div>
    </header>
  );
}
