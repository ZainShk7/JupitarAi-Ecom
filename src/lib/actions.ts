"use server";

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { products, type NewProduct } from "@/db/schema";
import {
  NEW_PRODUCT_DEFAULTS,
  productFieldsPatchSchema,
  type ProductFields,
} from "@/lib/product-schema";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type ActionResultWithData<T> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  return { ok: false, error: error instanceof Error ? error.message : "Something went wrong" };
}

export async function createProduct(): Promise<ActionResultWithData<{ id: string }>> {
  try {
    const id = nanoid();
    await db.insert(products).values({ id, ...NEW_PRODUCT_DEFAULTS });
    revalidatePath("/");
    return { ok: true, data: { id } };
  } catch (error) {
    return fail(error);
  }
}

export async function updateProduct(
  id: string,
  patch: Partial<ProductFields>,
): Promise<ActionResult> {
  try {
    const parsed = productFieldsPatchSchema.safeParse(patch);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }
    if (Object.keys(parsed.data).length === 0) return { ok: true };
    await db
      .update(products)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(products.id, id));
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function duplicateProduct(id: string): Promise<ActionResultWithData<{ id: string }>> {
  try {
    const [source] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!source) return { ok: false, error: "Product not found" };
    const newId = nanoid();
    const { id: _oldId, createdAt: _createdAt, updatedAt: _updatedAt, ...fields } = source;
    await db.insert(products).values({
      ...fields,
      id: newId,
      name: `${source.name} (copy)`,
    });
    revalidatePath("/");
    return { ok: true, data: { id: newId } };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  try {
    await db.delete(products).where(eq(products.id, id));
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Re-inserts a product exactly as it was, for undoing a delete. */
export async function restoreProduct(product: NewProduct): Promise<ActionResult> {
  try {
    await db.insert(products).values(product);
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
