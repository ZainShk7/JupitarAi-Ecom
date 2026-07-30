import { AppHeader } from "@/components/app-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <AppHeader active="pipeline" />
      <main className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <Skeleton className="h-8 w-96" />
          <Skeleton className="h-40 w-full" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </main>
    </>
  );
}
