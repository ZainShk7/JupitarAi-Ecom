import { AppHeader } from "@/components/app-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <AppHeader active="import" />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
        <Skeleton className="h-40 w-full max-w-lg self-center" />
      </main>
    </>
  );
}
