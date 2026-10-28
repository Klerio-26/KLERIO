"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { completeReminder, createReminder, deleteReminder, markNotificationsRead } from "@/lib/reminders";
import { audit } from "@/lib/audit";
import { zonedDateTimeToUtc } from "@/lib/quota/periods";

export interface ReminderState {
  ok: boolean;
  error?: string;
  message?: string;
}

export async function createReminderAction(_prev: ReminderState, formData: FormData): Promise<ReminderState> {
  const { user } = await requireUser();
  try {
    const title = String(formData.get("title") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const dueRaw = String(formData.get("dueAt") ?? "");
    if (!dueRaw) return { ok: false, error: "Choisissez une date d'échéance." };
    const [year, month, day] = dueRaw.split("-").map(Number);
    const dueAt = zonedDateTimeToUtc(year, month, day, 9, 0, 0);
    if (Number.isNaN(dueAt.getTime())) return { ok: false, error: "Date invalide." };
    const channels = formData.getAll("channels").map(String).filter((c) => ["in_app", "email", "push"].includes(c));
    const advance = String(formData.get("advanceDays") ?? "")
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isFinite(n) && n > 0 && n <= 60);
    const visibility = String(formData.get("visibility") ?? "personal") === "family" ? "family" : "personal";
    const documentId = String(formData.get("documentId") ?? "").trim() || null;
    await createReminder({
      userId: user.id,
      title,
      notes,
      dueAt,
      recurrence: String(formData.get("recurrence") ?? "none"),
      channels,
      visibility,
      advanceDays: advance,
      documentId
    });
    revalidatePath("/app/reminders");
    revalidatePath("/app");
    return { ok: true, message: "Rappel créé." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Impossible de créer le rappel." };
  }
}

export async function completeReminderAction(formData: FormData): Promise<void> {
  const { user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  await completeReminder(user.id, id);
  await audit({ actorId: user.id, action: "reminder.done", targetType: "reminder", targetId: id });
  revalidatePath("/app/reminders");
  revalidatePath("/app");
}

export async function deleteReminderAction(formData: FormData): Promise<void> {
  const { user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  await deleteReminder(user.id, id);
  revalidatePath("/app/reminders");
}

export async function markNotificationsReadAction(): Promise<void> {
  const { user } = await requireUser();
  await markNotificationsRead(user.id);
  revalidatePath("/app/reminders");
  revalidatePath("/app");
}
