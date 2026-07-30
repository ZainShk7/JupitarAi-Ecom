import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { ProductDetail } from "@/components/detail/product-detail";
import { getProductById } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();

  return (
    <>
      <AppHeader active="pipeline" />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ProductDetail product={product} />
      </main>
    </>
  );
}
