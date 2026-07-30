import { AppHeader } from "@/components/app-header";
import { ExportPanel } from "@/components/import/export-panel";
import { ImportWizard } from "@/components/import/import-wizard";
import { getPipelineData } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const { rows } = await getPipelineData();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AppHeader active="import" />
      <ExportPanel rows={rows} />
      <ImportWizard />
    </div>
  );
}
