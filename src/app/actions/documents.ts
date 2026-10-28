"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { emptyTrash, purgeDocument, restoreDocument, trashDocument } from "@/lib/storage/service";
import { shareDocumentWithFamily } from "@/lib/family";
import { audit } from "@/lib/audit";

export interface ActionResult {
  ok: boolean;
  message?: string;
  error?: string;
}

export async function updateDocumentAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const doc = await db.document.findFirst({ where: { id, ownerId: user.id } });
  if (!doc) return { ok: false, error: "Document introuvable." };

  const title = String(formData.get("title") ?? "").trim().slice(0, 160);
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;
  const dueDateRaw = String(formData.get("dueDate") ?? "").trim();
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);

  if (categoryId) {
    const category = await db.category.findFirst({
      where: { id: categoryId, OR: [{ ownerId: user.id }, { ownerId: null }] }
    });
    if (!category) return { ok: false, error: "Catégorie invalide." };
  }

  await db.document.update({
    where: { id: doc.id },
    data: {
      title: title || doc.title,
      categoryId,
      dueDate: dueDateRaw ? new Date(`${dueDateRaw}T12:00:00.000Z`) : null,
      tags: JSON.stringify(tags)
    }
  });
  await audit({ actorId: user.id, action: "document.update", targetType: "document", targetId: doc.id });
  revalidatePath("/app/vault");
  revalidatePath(`/app/vault/${doc.id}`);
  return { ok: true, message: "Document mis à jour." };
}

export async function trashDocumentAction(formData: FormData): Promise<void> {
  const { user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  await trashDocument(user.id, id);
  revalidatePath("/app/vault");
  revalidatePath(`/app/vault/${id}`);
}

export async function restoreDocumentAction(formData: FormData): Promise<void> {
  const { user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  await restoreDocument(user.id, id);
  revalidatePath("/app/vault");
  revalidatePath(`/app/vault/${id}`);
}

export async function purgeDocumentAction(formData: FormData): Promise<void> {
  const { user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (formData.get("confirm") !== "on") return;
  await purgeDocument(user.id, id, true);
  revalidatePath("/app/vault");
}

export async function emptyTrashAction(): Promise<void> {
  const { user } = await requireUser();
  await emptyTrash(user.id);
  revalidatePath("/app/vault");
}

export async function shareDocumentAction(formData: FormData): Promise<void> {
  const { user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const share = formData.get("share") === "1";
  await shareDocumentWithFamily(user.id, id, share);
  revalidatePath("/app/vault");
  revalidatePath(`/app/vault/${id}`);
}
