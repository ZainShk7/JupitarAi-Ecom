import { AppHeader } from "@/components/app-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <AppHeader active="pipeline" />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-hairline bg-surface px-4 py-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="ml-auto h-8 w-28" />
        </div>
        <div className="flex flex-1 flex-col gap-px overflow-hidden p-4">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full shrink-0" />
          ))}
        </div>
      </main>
    </>
  );
}
