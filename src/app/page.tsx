import { AppHeader } from "@/components/app-header";
import { PipelineGrid } from "@/components/pipeline/pipeline-grid";
import { getPipelineData } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { rows, categories, settings } = await getPipelineData();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AppHeader active="pipeline" />
      <PipelineGrid rows={rows} categories={categories} settings={settings} />
    </div>
  );
}
