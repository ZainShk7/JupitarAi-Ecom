import { AppHeader } from "@/components/app-header";
import { PipelineGrid } from "@/components/pipeline/pipeline-grid";
import { loadPipelineSearchParams } from "@/lib/pipeline-query";
import { getPipelineData } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await loadPipelineSearchParams(searchParams);
  const data = await getPipelineData(query);

  return (
    <>
      <AppHeader active="pipeline" />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PipelineGrid data={data} />
      </main>
    </>
  );
}
