import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, CalendarClock, CheckCircle2, Clock3, Repeat, Trash2, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { listReminders } from "@/lib/reminders";
import { getAccountSnapshot } from "@/lib/quota/service";
import { completeReminderAction, deleteReminderAction, markNotificationsReadAction } from "@/app/actions/reminders";
import { formatDate, formatDateTime, dueLabel, parseJsonArray } from "@/lib/utils";
import { Badge, Card, EmptyState, SectionHeader } from "@/components/ui";
import { ReminderForm } from "@/components/reminder-form";
import { PushToggle } from "@/components/push-toggle";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Rappels" };
export const dynamic = "force-dynamic";

export default async function RemindersPage({
  searchParams
}: {
  searchParams: Promise<{ document?: string; title?: string }>;
}) {
  const { user, familyGroupId } = await requireUser();
  const { document: documentId, title } = await searchParams;
  const snapshot = await getAccountSnapshot(user.id);
  const reminders = await listReminders(user.id);
  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10
  });
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-title">Rappels et notifications</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Ne plus rien oublier.</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-600 dark:text-ink-300">
            Une date, une action, un rappel. Klerio vous prévient dans l'application, par e-mail ou en notification.
          </p>
        </div>
        {unread > 0 && (
          <form action={markNotificationsReadAction}>
            <button type="submit" className="btn-secondary text-xs">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Tout marquer comme lu ({unread})
            </button>
          </form>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
        <section className="space-y-3">
          <SectionHeader title="Vos rappels à venir" description="Les rappels familiaux sont visibles par tous les membres du groupe." />
          {reminders.length === 0 ? (
            <EmptyState
              title="Aucun rappel"
              description="Créez votre premier rappel à droite, ou depuis un document dans le coffre-fort."
            />
          ) : (
            <ul className="space-y-3">
              {reminders.map((reminder) => {
                const late = reminder.dueAt < new Date();
                const channels = parseJsonArray(reminder.channels);
                const advance = parseJsonArray(reminder.advanceDays);
                return (
                  <li key={reminder.id} className="card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={late ? "danger" : "warning"}>
                            <Clock3 className="h-3 w-3" aria-hidden="true" /> {dueLabel(reminder.dueAt)}
                          </Badge>
                          {reminder.visibility === "family" && (
                            <Badge tone="brand">
                              <Users className="h-3 w-3" aria-hidden="true" /> Famille
                            </Badge>
                          )}
                          {reminder.recurrence !== "none" && (
                            <Badge>
                              <Repeat className="h-3 w-3" aria-hidden="true" /> {reminder.recurrence}
                            </Badge>
                          )}
                          {channels.map((channel) => (
                            <span key={channel} className="chip px-2 py-0.5 text-[0.65rem]">
                              {channel === "in_app" ? "app" : channel}
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 font-bold">{reminder.title}</p>
                        {reminder.notes && <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{reminder.notes}</p>}
                        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                          {formatDate(reminder.dueAt)}
                          {advance.length > 0 ? ` · alertes ${advance.join(", ")} j avant` : ""}
                          {reminder.document ? ` · lié à « ${reminder.document.title} »` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <form action={completeReminderAction}>
                          <input type="hidden" name="id" value={reminder.id} />
                          <button type="submit" className="btn-secondary text-xs" aria-label={`Marquer « ${reminder.title} » comme fait`}>
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Fait
                          </button>
                        </form>
                        {reminder.userId === user.id && (
                          <form action={deleteReminderAction}>
                            <input type="hidden" name="id" value={reminder.id} />
                            <button type="submit" className="btn-ghost h-10 w-10 p-0" aria-label={`Supprimer « ${reminder.title} »`}>
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">Notifications récentes</h2>
              <Badge>{notifications.length}</Badge>
            </div>
            {notifications.length === 0 ? (
              <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">Aucune notification pour le moment.</p>
            ) : (
              <ul className="mt-3 divide-y divide-ink-100 dark:divide-ink-800">
                {notifications.map((notification) => (
                  <li key={notification.id} className="py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`text-sm ${notification.readAt ? "font-medium" : "font-bold"}`}>{notification.title}</p>
                        <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{notification.body}</p>
                      </div>
                      <span className="shrink-0 text-[0.68rem] text-ink-400">{formatDateTime(notification.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 border-t border-ink-200 pt-3 dark:border-ink-800">
              <p className="text-sm font-bold">Notifications push</p>
              <p className="hint mb-2">
                Recevez une alerte sur cet appareil, même lorsque Klerio est fermé. Nécessite l'installation de la PWA
                et l'autorisation du navigateur.
              </p>
              <PushToggle publicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} configured={Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY)} />
            </div>
          </Card>
        </section>

        <section className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <h2 className="font-bold">Nouveau rappel</h2>
            </div>
            <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
              {snapshot.context.planId === "standard"
                ? "Rappels de base inclus. Les options avancées sont réservées à Pro."
                : "Rappels avancés activés : répétition, alertes multiples, e-mail et push."}
            </p>
            <div className="mt-4">
              <ReminderForm
                planId={snapshot.context.planId}
                hasFamily={Boolean(familyGroupId)}
                initialTitle={title}
                documentId={documentId}
                defaultDate={new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)}
              />
            </div>
            <div className="mt-5 rounded-xl bg-ink-50 p-3 text-xs text-ink-600 dark:bg-ink-900 dark:text-ink-300">
              <p className="font-bold">Règle de rappel</p>
              <p className="mt-1">
                Les rappels sont envoyés à 09h00 (Europe/Paris). Les quotas hebdomadaires se réinitialisent le lundi
                à 00h00. Aucun rappel ne part sans que vous l'ayez créé.
              </p>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
