import { AppHeader } from "@/components/app-header";
import { PipelineGrid } from "@/components/pipeline/pipeline-grid";
import { getPipelineData } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { rows, categories } = await getPipelineData();

  return (
    <>
      <AppHeader active="pipeline" />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PipelineGrid rows={rows} categories={categories} />
      </main>
    </>
  );
}
