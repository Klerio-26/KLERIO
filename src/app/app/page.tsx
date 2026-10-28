import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  Clock3,
  FolderLock,
  ScanLine,
  ShieldAlert,
  Sparkles,
  Users
} from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getAccountSnapshot } from "@/lib/quota/service";
import { listReminders } from "@/lib/reminders";
import { completeReminderAction } from "@/app/actions/reminders";
import { formatBytes, formatPrice, storageRatio } from "@/lib/quota/plans";
import { dueLabel, formatDate } from "@/lib/utils";
import { Badge, Card, EmptyState, Progress, SectionHeader, StatCard } from "@/components/ui";
import { DocumentCard } from "@/components/document-card";

export const metadata = { title: "Tableau de bord" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  const { user, familyGroupId } = await requireUser();
  const { bienvenue } = await searchParams;
  const snapshot = await getAccountSnapshot(user.id);
  const reminders = (await listReminders(user.id)).slice(0, 4);
  const group = familyGroupId ? await db.familyGroup.findUnique({ where: { id: familyGroupId }, select: { name: true } }) : null;

  const documents = await db.document.findMany({
    where: {
      status: "active",
      OR: [
        { ownerId: user.id },
        ...(familyGroupId ? [{ groupId: familyGroupId, visibility: "family" }] : [])
      ]
    },
    include: { category: { select: { label: true } } },
    orderBy: { createdAt: "desc" },
    take: 4
  });

  const scan = snapshot.lines.find((line) => line.definition.type === "scan_pages")!;
  const explanations = snapshot.lines.find((line) => line.definition.type === "explanations")!;
  const emails = snapshot.lines.find((line) => line.definition.type === "email_generations")!;
  const firstName = user.name?.split(" ")[0] ?? "bonjour";
  const today = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="space-y-7">
      {bienvenue && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-100">
          <strong>Bienvenue sur Klerio.</strong> Votre espace est prêt : 20 pages de scan vous attendent, à vie.
        </div>
      )}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-ink-500 first-letter:uppercase dark:text-ink-400">{today}</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
            Bonjour {firstName}
            <span className="ml-1.5" aria-hidden="true">👋</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-600 dark:text-ink-300">
            Une chose à la fois. Voici ce qui compte aujourd'hui — le reste peut attendre.
          </p>
        </div>
        <Link href="/app/scan" className="btn-primary">
          <ScanLine className="h-4 w-4" aria-hidden="true" />
          Scanner un document
        </Link>
      </header>

      <section aria-label="Vos compteurs">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Pages de scan"
            value={`${scan.remaining} restantes`}
            hint={scan.definition.periodicity === "lifetime" ? `Sur ${scan.limit} à vie — jamais réinitialisées` : `Sur ${scan.limit} ce mois-ci`}
            icon={<ScanLine className="h-5 w-5" aria-hidden="true" />}
          />
          <StatCard
            label="Explications IA"
            value={`${explanations.remaining} restantes`}
            hint={`Sur ${explanations.limit} · renouvellement ${formatDate(explanations.resetAt)}`}
            icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
            tone="violet"
          />
          <StatCard
            label="Stockage du coffre"
            value={`${formatBytes(snapshot.storage.usedBytes)} / ${formatBytes(snapshot.storage.limitBytes)}`}
            hint={familyGroupId ? "Pool famille partagé" : "Espace personnel"}
            icon={<FolderLock className="h-5 w-5" aria-hidden="true" />}
            tone="sky"
          />
          <StatCard
            label="Crédits"
            value={`${snapshot.credits} crédits`}
            hint={snapshot.context.plan.creditsEnabled ? "Achetables par tranche de 2 € à 20 €" : "Réservés aux forfaits Pro"}
            icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
            tone="amber"
          />
        </div>
      </section>

      <section>
        <SectionHeader eyebrow="Actions directes" title="Que voulez-vous faire ?" description="Trois portes d'entrée, pas davantage." />
        <div className="grid gap-3 md:grid-cols-3">
          <Link href="/app/scan" className="card group flex flex-col p-5 transition-colors hover:border-brand-300 dark:hover:border-brand-700">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-800 dark:bg-brand-900/50 dark:text-brand-200">
              <ScanLine className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="mt-4 font-bold">J'ai un document à scanner</span>
            <span className="mt-1 text-sm text-ink-600 dark:text-ink-300">Photo ou PDF, plusieurs pages, prêt à classer.</span>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 group-hover:gap-2 dark:text-brand-300">
              Ouvrir le scanner <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </Link>
          <Link href="/app/assistant" className="card group flex flex-col p-5 transition-colors hover:border-brand-300 dark:hover:border-brand-700">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="mt-4 font-bold">J'ai un document à comprendre</span>
            <span className="mt-1 text-sm text-ink-600 dark:text-ink-300">De quoi s'agit-il ? Que faire, et avant quand ?</span>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 group-hover:gap-2 dark:text-brand-300">
              Demander à Klerio <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </Link>
          <Link href="/app/vault" className="card group flex flex-col p-5 transition-colors hover:border-brand-300 dark:hover:border-brand-700">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200">
              <FolderLock className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="mt-4 font-bold">Je veux ranger mes papiers</span>
            <span className="mt-1 text-sm text-ink-600 dark:text-ink-300">
              {formatBytes(snapshot.storage.usedBytes)} déjà protégés, {formatBytes(Math.max(0, snapshot.storage.limitBytes - snapshot.storage.usedBytes))} disponibles.
            </span>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 group-hover:gap-2 dark:text-brand-300">
              Voir mon coffre-fort <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </Link>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Vos rappels"
            title="À faire bientôt"
            action={
              <Link href="/app/reminders" className="link text-sm">
                Tout voir
              </Link>
            }
          />
          {reminders.length === 0 ? (
            <EmptyState
              title="Aucun rappel pour l'instant"
              description="Ajoutez une échéance depuis un document ou créez un rappel simple. Klerio vous préviendra au bon moment."
              action={<Link href="/app/reminders" className="btn-secondary">Créer un rappel</Link>}
            />
          ) : (
            <ul className="space-y-3">
              {reminders.map((reminder) => {
                const late = reminder.dueAt < new Date();
                return (
                  <li key={reminder.id} className="card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={late ? "danger" : "warning"}>
                            <Clock3 className="h-3 w-3" aria-hidden="true" />
                            {dueLabel(reminder.dueAt)}
                          </Badge>
                          {reminder.visibility === "family" && <Badge tone="brand">Famille</Badge>}
                          {reminder.recurrence !== "none" && <Badge>Récurrent</Badge>}
                        </div>
                        <p className="mt-2 font-bold leading-snug">{reminder.title}</p>
                        {reminder.notes && <p className="mt-1 line-clamp-2 text-sm text-ink-600 dark:text-ink-300">{reminder.notes}</p>}
                        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{formatDate(reminder.dueAt)}</p>
                      </div>
                      <form action={completeReminderAction}>
                        <input type="hidden" name="id" value={reminder.id} />
                        <button type="submit" className="btn-ghost h-10 shrink-0 px-3 text-xs" aria-label={`Marquer « ${reminder.title} » comme fait`}>
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Fait
                        </button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-4">
          <SectionHeader eyebrow="Coffre-fort" title="Derniers documents" action={<Link href="/app/vault" className="link text-sm">Ouvrir</Link>} />
          {documents.length === 0 ? (
            <EmptyState
              title="Votre coffre est vide"
              description="Scannez votre premier document : il sera chiffré et rangé en quelques secondes."
              action={<Link href="/app/scan" className="btn-primary">Scanner</Link>}
            />
          ) : (
            <div className="space-y-2.5">
              {documents.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} showVisibility />
              ))}
            </div>
          )}
          <Card className="bg-brand-50/60 dark:bg-brand-950/20">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>Stockage {familyGroupId ? "famille" : "personnel"}</span>
              <span>{Math.round(storageRatio(snapshot.storage.usedBytes, snapshot.storage.limitBytes) * 100)} %</span>
            </div>
            <div className="mt-2">
              <Progress
                value={storageRatio(snapshot.storage.usedBytes, snapshot.storage.limitBytes) * 100}
                tone={snapshot.storage.ratio >= 0.9 ? "danger" : snapshot.storage.ratio >= 0.8 ? "warning" : "brand"}
                label="Stockage utilisé"
              />
            </div>
            <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
              {formatBytes(snapshot.storage.usedBytes)} utilisés sur {formatBytes(snapshot.storage.limitBytes)}.
              {snapshot.storage.usedBytes > 0 && " La corbeille compte jusqu'à sa vidange."}
            </p>
            <Link href="/app/quota" className="link mt-3 inline-block text-sm">
              Voir tous mes quotas
            </Link>
          </Card>
        </section>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="border-accent-200 bg-accent-50/60 dark:border-accent-900 dark:bg-accent-950/20">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-100 text-accent-800 dark:bg-accent-900/50 dark:text-accent-200">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-bold">Un doute sur un courrier ?</p>
              <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
                Klerio vérifie les liens, l'urgence et les demandes de paiement. Il ne clique jamais à votre place.
              </p>
              <Link href="/app/assistant" className="btn-secondary mt-3">
                Vérifier un message
              </Link>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-800 dark:bg-brand-900/50 dark:text-brand-200">
              {familyGroupId ? <Users className="h-5 w-5" aria-hidden="true" /> : <BellRing className="h-5 w-5" aria-hidden="true" />}
            </span>
            <div>
              <p className="font-bold">{familyGroupId ? group?.name ?? "Votre famille" : `Forfait ${snapshot.context.plan.name}`}</p>
              <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
                {familyGroupId
                  ? "Chaque membre garde ses documents privés. Seul ce qui est partagé explicitement est visible."
                  : `${formatPrice(snapshot.context.plan.priceMonthlyCents)} / mois. ${emails.remaining} e-mail(s) restant(s) cette semaine.`}
              </p>
              <Link href={familyGroupId ? "/app/family" : "/app/billing"} className="btn-ghost mt-3 px-0">
                {familyGroupId ? "Gérer la famille" : "Voir mon forfait"} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
