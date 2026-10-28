import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, CreditCard, Download, ExternalLink, ReceiptText, ShieldCheck, Sparkles } from "lucide-react";
import { allowSimulation, stripeEnabled } from "@/lib/env";
import { requireUser } from "@/lib/auth/session";
import { getBillingOverview, getPlanChangeSummary, type PlanChangeSummary } from "@/lib/billing/service";
import { getAccountSnapshot } from "@/lib/quota/service";
import { grantDemoCreditsAction, manageSubscriptionAction } from "@/app/actions/billing";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Alert, Badge, Card, SectionHeader, StatCard } from "@/components/ui";
import { CreditsForm, PlanSwitcher } from "@/components/billing-client";
import { formatPrice, type PlanId } from "@/lib/quota/plans";

export const metadata: Metadata = { title: "Forfait et crédits" };
export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams
}: {
  searchParams: Promise<{ checkout?: string; credits?: string }>;
}) {
  const { user } = await requireUser();
  const { checkout, credits: creditsStatus } = await searchParams;
  const [overview, snapshot] = await Promise.all([getBillingOverview(user.id), getAccountSnapshot(user.id)]);

  const summaries: Record<string, PlanChangeSummary> = {};
  for (const planId of ["standard", "pro", "family"] as PlanId[]) {
    for (const interval of ["monthly", "yearly"] as const) {
      summaries[`${planId}:${interval}`] = await getPlanChangeSummary(user.id, planId, interval);
    }
  }

  const subscription = overview.subscription;
  const resetLabel = snapshot.resetAnchor;

  return (
    <div className="space-y-6">
      <header>
        <p className="section-title">Abonnement et crédits</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Transparent, jusqu'au bout.</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-600 dark:text-ink-300">
          Vous voyez toujours ce qui est inclus, ce qui sera débité, et quand le quota repart. Aucun dépassement payant
          sans votre accord explicite.
        </p>
      </header>

      {checkout === "success" && <Alert tone="success" title="Paiement confirmé">Votre nouveau forfait est actif. Merci de votre confiance.</Alert>}
      {creditsStatus === "success" && <Alert tone="success" title="Crédits ajoutés">Vos crédits sont disponibles immédiatement, séparément de vos quotas inclus.</Alert>}
      {checkout === "cancel" && <Alert tone="warning" title="Paiement annulé">Aucun montant n'a été débité. Votre forfait actuel ne change pas.</Alert>}

      {!stripeEnabled && (
        <Alert tone="info" title={allowSimulation ? "Mode démonstration : aucun paiement réel" : "Paiement non configuré"}>
          {allowSimulation ? (
            <>
              Stripe n'est pas configuré. Les changements de forfait et les achats de crédits sont simulés, sans aucun
              débit. Renseignez <code className="rounded bg-black/5 px-1 dark:bg-white/10">STRIPE_SECRET_KEY</code> et
              les identifiants de prix dans <code className="rounded bg-black/5 px-1 dark:bg-white/10">.env</code> pour
              activer le paiement réel.
            </>
          ) : (
            <>Le paiement n'est pas disponible sur cette installation. Contactez le support.</>
          )}
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Forfait actuel" value={overview.plan.name} hint={formatPrice(overview.plan.priceMonthlyCents) + " / mois TTC"} icon={<CreditCard className="h-5 w-5" aria-hidden="true" />} />
        <StatCard label="Crédits" value={`${overview.credits}`} hint="1 crédit = 0,10 €" icon={<Sparkles className="h-5 w-5" aria-hidden="true" />} tone="amber" />
        <StatCard
          label="Prochaine échéance"
          value={subscription?.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : "—"}
          hint={subscription?.cancelAtPeriodEnd ? "Résiliation programmée" : "Renouvellement automatique"}
          icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
          tone="sky"
        />
        <StatCard
          label="Stockage"
          value={`${overview.plan.storageBytes ? Math.round((snapshot.storage.usedBytes / overview.plan.storageBytes) * 100) : 0} %`}
          hint={`${snapshot.storage.state === "read_only" ? "Lecture seule" : "Normal"}`}
          icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-bold">Gérer mon abonnement</p>
            <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
              {subscription?.cancelAtPeriodEnd
                ? `Votre abonnement s'arrêtera le ${formatDate(subscription.currentPeriodEnd)}. Vous conservez vos accès jusqu'à cette date.`
                : "Résiliation, moyens de paiement, factures et coordonnées : tout se gère en quelques clics."}
            </p>
            <p className="hint mt-1">Quotas mensuels : {resetLabel}. Quotas hebdomadaires : chaque lundi à 00h00 (Europe/Paris).</p>
          </div>
          <form action={manageSubscriptionAction}>
            <button type="submit" className="btn-secondary">
              {stripeEnabled ? "Ouvrir le portail Stripe" : allowSimulation ? "Résilier à la fin de période (démo)" : "Gérer"}
            </button>
          </form>
        </div>
      </Card>

      <section>
        <SectionHeader
          eyebrow="Changer d'offre"
          title="Les forfaits"
          description="Avant de valider, Klerio affiche les conséquences sur vos quotas, votre stockage et le prorata."
        />
        <PlanSwitcher
          plans={overview.plans}
          currentPlanId={snapshot.context.planId}
          summaries={summaries}
          stripeConfigured={stripeEnabled}
          simulation={allowSimulation}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <SectionHeader title="Crédits prépayés" description="Pour les actions hors quota : classement IA, pages, analyses, remplissage." />
          <p className="mb-3 text-2xl font-black">
            {overview.credits} <span className="text-sm font-semibold text-ink-500 dark:text-ink-400">crédits disponibles</span>
          </p>
          {snapshot.context.plan.creditsEnabled ? (
            <CreditsForm credits={overview.credits} simulation={!stripeEnabled && allowSimulation} />
          ) : (
            <Alert tone="info" title="Crédits réservés aux forfaits Pro">
              Le forfait Standard ne permet pas d'acheter des crédits. Passez à Pro pour utiliser le classement IA et
              les actions à l'unité.
            </Alert>
          )}
          {allowSimulation && snapshot.context.plan.creditsEnabled && (
            <form action={grantDemoCreditsAction} className="mt-3">
              <button type="submit" className="btn-ghost text-xs">+ 50 crédits de démonstration</button>
            </form>
          )}
        </Card>

        <Card>
          <SectionHeader title="Historique des crédits" description="Les crédits sont toujours séparés des quotas inclus." />
          {overview.transactions.length === 0 ? (
            <p className="text-sm text-ink-500 dark:text-ink-400">Aucun mouvement pour l'instant.</p>
          ) : (
            <ul className="divide-y divide-ink-100 text-sm dark:divide-ink-800">
              {overview.transactions.map((transaction) => (
                <li key={transaction.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{transaction.reason.replaceAll("_", " ")}</p>
                    <p className="text-xs text-ink-500 dark:text-ink-400">{formatDateTime(transaction.createdAt)}</p>
                  </div>
                  <span className={transaction.delta > 0 ? "font-bold text-emerald-700 dark:text-emerald-300" : "font-bold text-red-700 dark:text-red-300"}>
                    {transaction.delta > 0 ? "+" : ""}
                    {transaction.delta}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section>
        <SectionHeader
          title="Factures"
          description="Prix TTC, TVA 20 % incluse. Les factures sont téléchargeables après paiement."
          action={<Badge tone="brand"><ReceiptText className="h-3.5 w-3.5" aria-hidden="true" /> Téléchargeables</Badge>}
        />
        <Card className="p-0">
          {overview.invoices.length === 0 ? (
            <p className="p-5 text-sm text-ink-500 dark:text-ink-400">Aucune facture pour l'instant.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Vos factures Klerio</caption>
                <thead>
                  <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500 dark:border-ink-800 dark:text-ink-400">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Numéro</th>
                    <th className="px-4 py-3">Montant TTC</th>
                    <th className="px-4 py-3">TVA</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Document</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-ink-100 last:border-0 dark:border-ink-800">
                      <td className="px-4 py-3">{formatDate(invoice.createdAt)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{invoice.number ?? invoice.stripeInvoiceId.slice(0, 14)}</td>
                      <td className="px-4 py-3 font-semibold">{formatPrice(invoice.amountCents)}</td>
                      <td className="px-4 py-3">{formatPrice(invoice.taxCents)}</td>
                      <td className="px-4 py-3"><Badge tone={invoice.status === "paid" ? "success" : "warning"}>{invoice.status}</Badge></td>
                      <td className="px-4 py-3">
                        {invoice.pdfUrl ? (
                          <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1 text-xs">
                            <Download className="h-3.5 w-3.5" aria-hidden="true" /> PDF
                          </a>
                        ) : invoice.hostedUrl ? (
                          <a href={invoice.hostedUrl} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1 text-xs">
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Voir
                          </a>
                        ) : (
                          <span className="text-xs text-ink-400">Démo</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      <Card className="bg-ink-50/60 dark:bg-ink-900/40">
        <h2 className="font-bold">Les règles de facturation, sans surprise</h2>
        <ul className="mt-2 grid gap-2 text-sm text-ink-600 sm:grid-cols-2 dark:text-ink-300">
          <li>• Les 20 pages de scan Standard ne se réinitialisent jamais.</li>
          <li>• Les quotas mensuels repartent à la date anniversaire, à 00h00 (Paris).</li>
          <li>• Les quotas hebdomadaires repartent le lundi à 00h00 (Paris).</li>
          <li>• Un quota atteint ne déclenche jamais de paiement automatique.</li>
          <li>• Les crédits sont achetés séparément, sans reconduction.</li>
          <li>• Un downgrade ne supprime rien : lecture seule + 60 jours de grâce.</li>
        </ul>
        <p className="mt-3 text-xs text-ink-500 dark:text-ink-400">
          Une question sur une facture ? <Link href="/app/account" className="link">Contactez le support depuis votre compte</Link>.
        </p>
      </Card>
    </div>
  );
}
