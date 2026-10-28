import "server-only";
import { db } from "@/lib/db";
import { getAccountContext } from "@/lib/quota/service";
import { formatParisDate } from "@/lib/quota/periods";
import { parseJsonArray } from "@/lib/utils";
import { sendEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
import { audit } from "@/lib/audit";

export const REMINDER_CHANNELS = ["in_app", "email", "push"] as const;

export function nextOccurrence(date: Date, recurrence: string): Date | null {
  const next = new Date(date);
  switch (recurrence) {
    case "daily":
      next.setUTCDate(next.getUTCDate() + 1);
      return next;
    case "weekly":
      next.setUTCDate(next.getUTCDate() + 7);
      return next;
    case "monthly":
      next.setUTCMonth(next.getUTCMonth() + 1);
      return next;
    case "yearly":
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      return next;
    default:
      return null;
  }
}

export async function createReminder(input: {
  userId: string;
  title: string;
  notes?: string;
  dueAt: Date;
  recurrence?: string;
  channels?: string[];
  visibility?: "personal" | "family";
  advanceDays?: number[];
  documentId?: string | null;
}): Promise<string> {
  const context = await getAccountContext(input.userId);
  const recurrence = input.recurrence ?? "none";
  const advanceDays = (input.advanceDays ?? []).filter((n) => Number.isFinite(n) && n >= 0 && n <= 60);
  const advanced = recurrence !== "none" || advanceDays.length > 0 || (input.channels ?? []).some((c) => c !== "in_app");
  if (advanced && context.planId === "standard") {
    throw new Error("Les rappels avancés sont réservés aux forfaits Pro et Pro Famille. Passez à Pro pour les activer.");
  }
  if ((input.visibility ?? "personal") === "family" && !context.groupId) {
    throw new Error("Les rappels familiaux nécessitent un groupe famille.");
  }
  if (!input.title.trim()) throw new Error("Donnez un titre au rappel.");

  const reminder = await db.reminder.create({
    data: {
      userId: input.userId,
      groupId: context.groupId,
      documentId: input.documentId ?? null,
      title: input.title.trim().slice(0, 160),
      notes: input.notes?.slice(0, 2000),
      dueAt: input.dueAt,
      recurrence,
      channels: JSON.stringify(input.channels?.length ? input.channels : ["in_app"]),
      visibility: input.visibility ?? "personal",
      advanceDays: JSON.stringify(advanceDays)
    }
  });
  await audit({
    actorId: input.userId,
    action: "reminder.create",
    targetType: "reminder",
    targetId: reminder.id,
    metadata: { dueAt: input.dueAt.toISOString(), visibility: reminder.visibility }
  });
  return reminder.id;
}

export async function completeReminder(userId: string, reminderId: string): Promise<void> {
  const reminder = await db.reminder.findUnique({ where: { id: reminderId } });
  if (!reminder) throw new Error("Rappel introuvable.");
  const member = await db.familyMember.findUnique({ where: { userId } });
  const canAccess = reminder.userId === userId || (reminder.visibility === "family" && member && member.groupId === reminder.groupId);
  if (!canAccess) throw new Error("Rappel introuvable.");
  await db.reminder.update({
    where: { id: reminderId },
    data: { status: "done", completedAt: new Date() }
  });
  await audit({ actorId: userId, action: "reminder.complete", targetType: "reminder", targetId: reminderId });
}

export async function deleteReminder(userId: string, reminderId: string): Promise<void> {
  const reminder = await db.reminder.findUnique({ where: { id: reminderId } });
  if (!reminder || reminder.userId !== userId) throw new Error("Rappel introuvable.");
  await db.reminder.update({ where: { id: reminderId }, data: { status: "cancelled" } });
}

export async function listReminders(userId: string) {
  const member = await db.familyMember.findUnique({ where: { userId } });
  return db.reminder.findMany({
    where: {
      status: "pending",
      OR: [
        { userId },
        ...(member ? [{ groupId: member.groupId, visibility: "family" as const }] : [])
      ]
    },
    orderBy: { dueAt: "asc" },
    include: { document: { select: { id: true, title: true } } }
  });
}

function sameParisDay(a: Date, b: Date): boolean {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(a) === fmt.format(b);
}

/**
 * Cron de rappels. Idempotent : une notification par rappel et par jour.
 * Retourne le nombre de notifications créées.
 */
export async function runReminderCron(now = new Date()): Promise<{ created: number; emails: number }> {
  const horizon = new Date(now.getTime() + 31 * 86400000);
  const reminders = await db.reminder.findMany({
    where: { status: "pending", dueAt: { lte: horizon } },
    include: { user: { select: { id: true, email: true } } }
  });

  let created = 0;
  let emails = 0;

  for (const reminder of reminders) {
    const offsets = [0, ...parseJsonArray(reminder.advanceDays).map(Number).filter((n) => Number.isFinite(n))];
    const matches = offsets.some((offset) => {
      const target = new Date(reminder.dueAt.getTime() - offset * 86400000);
      return sameParisDay(target, now);
    });
    if (!matches) continue;

    const recent = await db.notification.findFirst({
      where: {
        reminderId: reminder.id,
        createdAt: { gte: new Date(now.getTime() - 20 * 3600000) }
      }
    });
    if (recent) continue;

    const audience = new Set<string>([reminder.userId]);
    if (reminder.visibility === "family" && reminder.groupId) {
      const members = await db.familyMember.findMany({ where: { groupId: reminder.groupId }, select: { userId: true } });
      for (const m of members) audience.add(m.userId);
    }

    const channels = parseJsonArray(reminder.channels);
    const title = `Rappel : ${reminder.title}`;
    const body = `Échéance ${formatParisDate(reminder.dueAt)}. ${reminder.notes ?? ""}`.trim();

    for (const userId of audience) {
      const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (channels.includes("in_app")) {
        await db.notification.create({
          data: { userId, reminderId: reminder.id, title, body, channel: "in_app", status: "sent", sentAt: now }
        });
        created += 1;
      }
      if (channels.includes("email") && user?.email) {
        const result = await sendEmail({ to: user.email, subject: title, text: body });
        await db.notification.create({
          data: {
            userId,
            reminderId: reminder.id,
            title,
            body,
            channel: "email",
            status: result.ok ? "sent" : "failed",
            sentAt: result.ok ? now : null
          }
        });
        created += 1;
        if (result.ok) emails += 1;
      }
      if (channels.includes("push")) {
        const pushed = await sendPushToUser(userId, { title, body, url: "/app/reminders" });
        await db.notification.create({
          data: {
            userId,
            reminderId: reminder.id,
            title,
            body,
            channel: "push",
            status: pushed.sent > 0 ? "sent" : "pending",
            sentAt: pushed.sent > 0 ? now : null
          }
        });
        created += 1;
      }
    }

    if (reminder.recurrence !== "none") {
      let next = nextOccurrence(reminder.dueAt, reminder.recurrence);
      let guard = 0;
      while (next && next.getTime() < now.getTime() && guard < 400) {
        next = nextOccurrence(next, reminder.recurrence);
        guard += 1;
      }
      if (next) {
        await db.reminder.update({ where: { id: reminder.id }, data: { dueAt: next } });
      }
    }
  }

  return { created, emails };
}

export async function markNotificationsRead(userId: string): Promise<void> {
  await db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() }
  });
}
