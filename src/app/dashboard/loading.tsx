import { AppHeader } from "@/components/app-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <AppHeader active="dashboard" />
      <main className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        </div>
      </main>
    </>
  );
}
