import { PipelineGrid } from "@/components/pipeline/pipeline-grid";
import { getPipelineData } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { rows, categories, settings } = await getPipelineData();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex items-center border-b border-hairline bg-surface px-4 py-2.5">
        <span className="font-display text-sm font-semibold tracking-wide text-ink">
          JUPITAR ECOM
        </span>
      </header>
      <PipelineGrid rows={rows} categories={categories} settings={settings} />
    </div>
  );
}
