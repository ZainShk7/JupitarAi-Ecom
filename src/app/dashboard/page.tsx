import { AppHeader } from "@/components/app-header";
import { Dashboard } from "@/components/dashboard/dashboard";
import { getDashboardRows } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const rows = await getDashboardRows();

  return (
    <>
      <AppHeader active="dashboard" />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Dashboard rows={rows} />
      </main>
    </>
  );
}
