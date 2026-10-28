"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { isValidCategory, categoryLabel } from "@/lib/categories";
import { audit } from "@/lib/audit";

export async function applyCategoryAction(formData: FormData): Promise<void> {
  const { user } = await requireUser();
  const documentId = String(formData.get("documentId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!isValidCategory(slug)) throw new Error("Catégorie invalide.");
  const doc = await db.document.findFirst({ where: { id: documentId, ownerId: user.id } });
  if (!doc) throw new Error("Document introuvable.");
  const category = await db.category.findFirst({ where: { slug, ownerId: null } });
  if (!category) throw new Error("Catégorie système introuvable.");
  await db.document.update({ where: { id: doc.id }, data: { categoryId: category.id } });
  await audit({
    actorId: user.id,
    action: "document.classify",
    targetType: "document",
    targetId: doc.id,
    metadata: { category: categoryLabel(slug) }
  });
  revalidatePath("/app/vault");
  revalidatePath(`/app/vault/${doc.id}`);
}
