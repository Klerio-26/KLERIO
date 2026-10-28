import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BookOpen, CreditCard, HardDrive, RotateCcw, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getAccountSnapshot } from "@/lib/quota/service";
import { getCreditBalance } from "@/lib/quota/service";
import { formatBytes, formatPrice } from "@/lib/quota/plans";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Badge, Card, Progress, SectionHeader, StatCard } from "@/components/ui";

export const metadata: Metadata = { title: "Mes quotas" };
export const dynamic = "force-dynamic";

export default async function QuotaPage() {
  const { user } = await requireUser();
  const snapshot = await getAccountSnapshot(user.id);
  const wallet = await getCreditBalance(user.id);
  const usages = await db.usageRecord.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30
  });

  const storagePct = snapshot.storage.ratio * 100;

  return (
    <div className="space-y-6">
      <header>
        <p className="section-title">Transparence</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Mes quotas, en détail.</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-600 dark:text-ink-300">
          Forfait {snapshot.context.plan.name}. Les quotas inclus et les crédits sont deux compteurs séparés. Rien ne
          se déclenche sans votre accord.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Forfait"
          value={snapshot.context.plan.name}
          hint={formatPrice(snapshot.context.plan.priceMonthlyCents) + " / mois TTC"}
          icon={<CreditCard className="h-5 w-5" aria-hidden="true" />}
        />
        <StatCard
          label="Crédits séparés"
          value={`${wallet.balance} crédits`}
          hint={`${formatPrice(wallet.balance * 10)} de valeur`}
          icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
          tone="amber"
        />
        <StatCard
          label="Stockage"
          value={`${formatBytes(snapshot.storage.usedBytes)} / ${formatBytes(snapshot.storage.limitBytes)}`}
          hint={`${Math.round(storagePct)} % utilisé`}
          icon={<HardDrive className="h-5 w-5" aria-hidden="true" />}
          tone="sky"
        />
      </div>

      <Card>
        <SectionHeader
          title="Quotas inclus"
          description={`Renouvellement mensuel : ${snapshot.resetAnchor}. Hebdomadaire : lundi 00h00 (Europe/Paris).`}
          action={<Link href="/app/billing" className="btn-secondary text-xs">Changer de forfait</Link>}
        />
        <div className="space-y-4">
          {snapshot.lines.map((line) => {
            const pct = line.limit > 0 ? Math.min(100, (line.used / line.limit) * 100) : 100;
            const lifetime = line.definition.periodicity === "lifetime";
            const tone = pct >= 100 ? "danger" : pct >= 80 ? "warning" : "brand";
            return (
              <div key={line.definition.type} className="rounded-xl border border-ink-200 p-4 dark:border-ink-800">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{line.definition.label}</p>
                    <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
                      {line.scopeLabel} ·{" "}
                      {lifetime ? "cumul à vie, jamais réinitialisé" : line.definition.periodicity === "weekly" ? "remis à zéro chaque lundi" : "remis à zéro chaque mois"}
                      {!lifetime ? ` · prochain reset ${formatDate(line.resetAt)}` : ""}
                    </p>
                  </div>
                  <Badge tone={pct >= 100 ? "danger" : pct >= 80 ? "warning" : "brand"}>
                    {line.remaining} restant{line.remaining > 1 ? "s" : ""} / {line.limit}
                  </Badge>
                </div>
                <div className="mt-3">
                  <Progress value={pct} tone={tone} label={`${line.definition.label} utilisé`} />
                </div>
                <p className="mt-1.5 text-xs text-ink-500 dark:text-ink-400">
                  {line.used} utilisé{line.used > 1 ? "s" : ""} {line.definition.unit}
                  {line.used > 1 ? "s" : ""}
                  {line.limit === 0 ? " · non inclus dans ce forfait" : ""}
                  {line.definition.creditUnitCost !== null && snapshot.context.plan.creditsEnabled
                    ? ` · au-delà : ${line.definition.creditUnitCost} crédit(s) / ${line.definition.unit}`
                    : ""}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Stockage" description="Compteur distinct des pages et des quotas IA." />
          <div className="flex items-end justify-between gap-2">
            <p className="text-2xl font-black">
              {formatBytes(snapshot.storage.usedBytes)}
              <span className="text-sm font-semibold text-ink-500 dark:text-ink-400"> / {formatBytes(snapshot.storage.limitBytes)}</span>
            </p>
            <Badge tone={snapshot.storage.state === "full" || snapshot.storage.state === "read_only" ? "danger" : snapshot.storage.state === "critical" ? "warning" : "brand"}>
              {snapshot.storage.state === "read_only"
                ? "Lecture seule"
                : snapshot.storage.state === "full"
                  ? "Plein"
                  : snapshot.storage.state === "critical"
                    ? "Alerte 90 %"
                    : snapshot.storage.state === "warning"
                      ? "Alerte 80 %"
                      : "Normal"}
            </Badge>
          </div>
          <div className="mt-2">
            <Progress value={storagePct} tone={storagePct >= 90 ? "danger" : storagePct >= 80 ? "warning" : "brand"} label="Stockage" />
          </div>
          <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
            La corbeille compte dans le stockage pendant 30 jours. À 100 %, le coffre reste consultable et exportable,
            mais les nouveaux enregistrements sont bloqués. Aucune suppression automatique.
          </p>
          {snapshot.context.groupId && snapshot.storage.memberUsedBytes !== null && (
            <div className="mt-3 rounded-xl bg-ink-50 p-3 text-xs dark:bg-ink-950">
              <p className="font-bold">Votre consommation personnelle</p>
              <p className="mt-1">
                {formatBytes(snapshot.storage.memberUsedBytes)} utilisés
                {snapshot.storage.memberLimitBytes ? ` · limite individuelle : ${formatBytes(snapshot.storage.memberLimitBytes)}` : " · aucune limite individuelle"}
              </p>
            </div>
          )}
          {snapshot.storage.graceEndsAt && (
            <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
              Lecture seule jusqu'au {formatDate(snapshot.storage.graceEndsAt)} : exportez ce qui compte.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <Link href="/app/vault" className="btn-secondary text-xs">Gérer mes documents</Link>
            <Link href="/app/billing" className="btn-ghost text-xs">Augmenter mon stockage</Link>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Crédits" description="Achetés séparément, jamais confondus avec les quotas inclus." />
          <p className="text-2xl font-black">
            {wallet.balance} <span className="text-sm font-semibold text-ink-500 dark:text-ink-400">crédits</span>
          </p>
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
            1 crédit = 0,10 €. Les crédits n'expirent pas tant que votre compte est actif.
          </p>
          <ul className="mt-3 space-y-1 text-xs text-ink-500 dark:text-ink-400">
            <li>• Page de scan supplémentaire : 1 crédit</li>
            <li>• Classement IA : 2 crédits</li>
            <li>• Explication standard : 3 crédits</li>
            <li>• Analyse approfondie : 6 crédits / page</li>
            <li>• Courrier : 4 crédits</li>
            <li>• Remplissage assisté : 15 crédits</li>
            <li>• Remplissage automatique : 30 crédits</li>
          </ul>
          <Link href="/app/billing" className="btn-secondary mt-3 text-xs">Acheter des crédits</Link>
        </Card>
      </div>

      <Card>
        <SectionHeader title="Dernières consommations" description="Chaque débit est tracé, avec sa source (quota inclus ou crédits)." />
        {usages.length === 0 ? (
          <p className="text-sm text-ink-500 dark:text-ink-400">Aucune consommation pour l'instant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Historique de consommation des quotas</caption>
              <thead>
                <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500 dark:border-ink-800 dark:text-ink-400">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Quantité</th>
                  <th className="py-2 pr-3">Quota inclus</th>
                  <th className="py-2">Crédits</th>
                </tr>
              </thead>
              <tbody>
                {usages.map((usage) => (
                  <tr key={usage.id} className="border-b border-ink-100 last:border-0 dark:border-ink-800">
                    <td className="py-2 pr-3 text-xs">{formatDateTime(usage.createdAt)}</td>
                    <td className="py-2 pr-3">{usage.type.replaceAll("_", " ")}</td>
                    <td className="py-2 pr-3">{usage.quantity}</td>
                    <td className="py-2 pr-3">{usage.fromIncluded}</td>
                    <td className="py-2">
                      {usage.creditsCost > 0 ? (
                        <span className="font-semibold text-amber-700 dark:text-amber-300">{usage.creditsCost}</span>
                      ) : (
                        "—"
                      )}
                      {usage.refundedAt && <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-300">remboursé</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 flex items-start gap-2 text-xs text-ink-500 dark:text-ink-400">
          <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Si une action IA échoue après débit, le quota est remboursé automatiquement. Les crédits et les quotas inclus
          apparaissent toujours sur deux lignes distinctes.
        </p>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link href="/app/billing" className="btn-primary">Gérer mon forfait et mes crédits <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        <Link href="/app/vault" className="btn-secondary">Voir mon coffre</Link>
      </div>
    </div>
  );
}
