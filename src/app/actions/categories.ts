"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { slugify } from "@/lib/utils";
import { audit } from "@/lib/audit";

export async function createCategoryAction(formData: FormData): Promise<void> {
  const { user } = await requireUser();
  const label = String(formData.get("label") ?? "").trim().slice(0, 60);
  if (!label) return;
  const slug = `${slugify(label)}-${user.id.slice(-4)}`;
  const existing = await db.category.findFirst({
    where: { ownerId: user.id, slug }
  });
  if (!existing) {
    await db.category.create({
      data: { ownerId: user.id, label, slug, icon: "folder", isSystem: false }
    });
    await audit({ actorId: user.id, action: "category.create", targetType: "category", metadata: { label } });
  }
  revalidatePath("/app/vault");
}
