"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, ArrowRight, Check, CreditCard, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import {
  buyCreditsAction,
  startPlanChangeAction,
  type BillingState
} from "@/app/actions/billing";
import { Badge, Card } from "@/components/ui";
import { formatBytes, formatPrice, type PlanDefinition, type PlanId } from "@/lib/quota/plans";

const initial: BillingState = { ok: false };

interface Summary {
  targetPlanId: PlanId;
  direction: "upgrade" | "downgrade" | "same";
  priceLabel: string;
  prorataLabel: string;
  storage: { usedBytes: number; currentLimitBytes: number; targetLimitBytes: number; becomesReadOnly: boolean };
  gained: string[];
  lost: string[];
  quotaChanges: Array<{ label: string; from: string; to: string }>;
  warnings: string[];
}

export function PlanSwitcher({
  plans,
  currentPlanId,
  summaries,
  stripeConfigured,
  simulation
}: {
  plans: PlanDefinition[];
  currentPlanId: PlanId;
  summaries: Record<string, Summary>;
  stripeConfigured: boolean;
  simulation: boolean;
}) {
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [selected, setSelected] = useState<PlanId | null>(null);
  const [state, action, pending] = useActionState(startPlanChangeAction, initial);
  const summary = selected ? summaries[`${selected}:${interval}`] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-600 dark:text-ink-300">Choisissez votre rythme de paiement.</p>
        <div className="inline-flex rounded-xl border border-ink-200 p-1 dark:border-ink-800" role="group" aria-label="Rythme de paiement">
          <button type="button" onClick={() => setInterval("monthly")} className={interval === "monthly" ? "rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-bold text-white dark:bg-brand-400 dark:text-ink-950" : "px-3 py-1.5 text-xs font-semibold"}>
            Mensuel
          </button>
          <button type="button" onClick={() => setInterval("yearly")} className={interval === "yearly" ? "rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-bold text-white dark:bg-brand-400 dark:text-ink-950" : "px-3 py-1.5 text-xs font-semibold"}>
            Annuel
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {plans.map((plan) => {
          const current = plan.id === currentPlanId;
          const price = interval === "yearly" ? plan.priceYearlyCents : plan.priceMonthlyCents;
          const highlighted = plan.id === "pro";
          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-5 ${
                current
                  ? "border-brand-600 bg-brand-50/50 dark:border-brand-500 dark:bg-brand-950/20"
                  : highlighted
                    ? "border-brand-300 bg-white shadow-card dark:border-brand-800 dark:bg-ink-900"
                    : "border-ink-200 bg-white/70 dark:border-ink-800 dark:bg-ink-900/60"
              }`}
            >
              {current && (
                <span className="absolute -top-3 left-4 rounded-full bg-brand-700 px-2.5 py-0.5 text-[0.65rem] font-bold text-white dark:bg-brand-400 dark:text-ink-950">
                  Votre forfait
                </span>
              )}
              <p className="font-black">{plan.name}</p>
              <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{plan.tagline}</p>
              <p className="mt-3 text-2xl font-black">
                {formatPrice(price)}
                <span className="text-xs font-semibold text-ink-500 dark:text-ink-400">
                  {" "}
                  / {interval === "yearly" ? "an" : "mois"} TTC
                </span>
              </p>
              {interval === "yearly" && plan.priceYearlyCents > 0 && (
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Soit {formatPrice(plan.priceYearlyCents / 12)} / mois
                </p>
              )}
              <ul className="mt-3 flex-1 space-y-1.5 text-xs">
                {plan.features.slice(0, 6).map((feature) => (
                  <li key={feature} className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={current}
                onClick={() => setSelected(plan.id)}
                className={current ? "btn-secondary mt-4 w-full text-xs" : "btn-primary mt-4 w-full text-xs"}
              >
                {current ? "Forfait actuel" : plan.id === "standard" ? "Revenir au Standard" : `Choisir ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {selected && summary && (
        <Card className="border-brand-300 dark:border-brand-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-black">Récapitulatif avant validation</h3>
            <Badge tone={summary.direction === "downgrade" ? "warning" : "brand"}>
              {summary.direction === "downgrade" ? "Downgrade" : "Upgrade"} · {summary.priceLabel}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">{summary.prorataLabel}</p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-ink-200 p-3 text-xs dark:border-ink-800">
              <p className="font-bold">Stockage</p>
              <p className="mt-1">
                Utilisé : {formatBytes(summary.storage.usedBytes)}. Nouvelle limite :{" "}
                {formatBytes(summary.storage.targetLimitBytes)}.
              </p>
              {summary.storage.becomesReadOnly ? (
                <p className="mt-1 font-semibold text-red-700 dark:text-red-300">
                  Au-delà de la limite : lecture seule + 60 jours de grâce. Aucun document supprimé.
                </p>
              ) : (
                <p className="mt-1 text-emerald-700 dark:text-emerald-300">Vos documents tiennent dans la nouvelle limite.</p>
              )}
            </div>
            <div className="rounded-xl border border-ink-200 p-3 text-xs dark:border-ink-800">
              <p className="font-bold">Quotas qui changent</p>
              {summary.quotaChanges.length === 0 ? (
                <p className="mt-1 text-ink-500 dark:text-ink-400">Aucun changement majeur.</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {summary.quotaChanges.slice(0, 5).map((change) => (
                    <li key={change.label}>
                      {change.label} : {change.from} → <strong>{change.to}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {(summary.gained.length > 0 || summary.lost.length > 0) && (
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              {summary.gained.length > 0 && (
                <p className="text-emerald-700 dark:text-emerald-300">+ {summary.gained.join(" · ")}</p>
              )}
              {summary.lost.length > 0 && (
                <p className="text-amber-700 dark:text-amber-300">− {summary.lost.join(" · ")}</p>
              )}
            </div>
          )}

          {summary.warnings.map((warning) => (
            <p key={warning} className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {warning}
            </p>
          ))}

          <form action={action} className="mt-4 space-y-3">
            <input type="hidden" name="planId" value={selected} />
            <input type="hidden" name="interval" value={interval} />
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="confirm" required className="mt-0.5" />
              <span>
                J'ai lu les conséquences sur mes quotas, mon stockage et mon prorata. Je confirme le changement.
              </span>
            </label>
            {state.error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{state.error}</p>}
            {state.ok && state.message && <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{state.message}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn-primary" disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CreditCard className="h-4 w-4" aria-hidden="true" />}
                {pending ? "Traitement…" : simulation && !stripeConfigured ? "Activer en démonstration" : "Continuer vers le paiement sécurisé"}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setSelected(null)}>
                Annuler
              </button>
            </div>
            <p className="hint">
              Prix TTC, TVA 20 % incluse. Aucun prélèvement n'a lieu avant la validation du paiement. En mode
              démonstration, aucun montant n'est débité.
            </p>
          </form>
        </Card>
      )}
      {state.ok && state.message && !selected && (
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{state.message}</p>
      )}
    </div>
  );
}

export function CreditsForm({ credits, simulation }: { credits: number; simulation: boolean }) {
  const [state, action, pending] = useActionState(buyCreditsAction, initial);
  const [amount, setAmount] = useState(5);
  const creditsPreview = Math.floor((amount * 100) / 10);

  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {[2, 5, 10, 20].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setAmount(value)}
            className={amount === value ? "badge bg-brand-700 text-white" : "chip"}
          >
            {value} €
          </button>
        ))}
      </div>
      <div>
        <label htmlFor="amount" className="label">Montant (2 € à 20 €)</label>
        <input
          id="amount"
          name="amount"
          type="number"
          min={2}
          max={20}
          step={0.5}
          className="input"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
        <p className="hint mt-1">
          {creditsPreview} crédits seront ajoutés. Solde actuel : {credits}. 1 crédit = 0,10 €. Achat unique, sans
          reconduction.
        </p>
      </div>
      {state.error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{state.error}</p>}
      {state.ok && state.message && <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{state.message}</p>}
      <button type="submit" className="btn-secondary w-full" disabled={pending || amount < 2 || amount > 20}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
        {pending ? "Paiement…" : simulation ? "Acheter (démonstration)" : "Acheter des crédits"}
      </button>
      <p className="hint flex items-start gap-1.5">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Les crédits sont distincts des quotas inclus. Ils restent sur votre compte tant qu'il est actif et figurent sur
        une ligne séparée de l'historique.
      </p>
    </form>
  );
}
