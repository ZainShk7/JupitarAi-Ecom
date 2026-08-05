import { AppHeader } from "@/components/app-header";
import { SourcingTabs } from "@/components/sourcing/sourcing-tabs";

export const dynamic = "force-dynamic";

export default function ResearchPage() {
  return (
    <>
      <AppHeader active="research" />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SourcingTabs />
      </main>
    </>
  );
}
