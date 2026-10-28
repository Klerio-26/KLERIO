"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  PenLine,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Languages,
  Wand2
} from "lucide-react";
import { Alert, Badge, Card, Progress } from "@/components/ui";
import { formatDate } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface QuotaDecision {
  allowed: boolean;
  message: string;
  includedRemaining: number;
  includedLimit: number;
  includedUsed: number;
  fromIncluded?: number;
  fromCredits?: number;
  creditsCost: number;
  creditBalance: number;
  requiresExplicitConsent?: boolean;
  resetAt: string;
  alternatives: Array<{ code: string; label: string; detail: string }>;
}

interface Detection {
  documentType: string;
  categorySlug: string;
  needsDeepAnalysis: boolean;
  confidence: number;
  reason: string;
  estimatedPages: number;
}

interface Analysis {
  documentType: string;
  title: string;
  summary: string;
  keyPoints: string[];
  actions: Array<{ title: string; detail: string; dueDate: string | null; mandatory: boolean }>;
  dates: Array<{ label: string; date: string | null }>;
  amounts: Array<{ label: string; amount: number; currency: string }>;
  risks: string[];
  scam: {
    score: number;
    level: "low" | "medium" | "high";
    signals: Array<{ label: string; detail: string }>;
    recommendation: string;
    confidence: number;
  };
  officialLinkSlug: string | null;
  needsDeepAnalysis: boolean;
  disclaimer: string;
  confidence: number;
}

interface OfficialLink {
  slug: string;
  label: string;
  url: string;
}

interface AnalyzeOutcome {
  analysis: Analysis;
  detection: Detection;
  quota: QuotaDecision;
  mode: "standard" | "deep";
  pageCount: number;
  degraded: boolean;
  provider: string;
  officialLink: OfficialLink | null;
}

interface PreviewOutcome {
  detection: Detection;
  standard: { decision: QuotaDecision; credits: number };
  deep: { decision: QuotaDecision; credits: number };
  deepPageCount: number;
}

interface EmailDraft {
  subject: string;
  body: string;
  tone: string;
  warnings: string[];
}

interface TranslationOutcome {
  result: { detectedLanguage: string; translatedText: string; notes: string[] };
  degraded: boolean;
  provider: string;
}

interface FillOutcome {
  result: {
    fields: Array<{ key: string; label: string; value: string | null; question: string | null; confidence: number }>;
    missing: string[];
    steps: string[];
    officialLinkSlug: string | null;
    disclaimer: string;
  };
  quota: QuotaDecision | null;
  creditsLeft: number | null;
  degraded: boolean;
  officialLink: OfficialLink | null;
}

class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(status: number, data: Record<string, unknown>) {
    super(String(data.error ?? "Erreur"));
    this.status = status;
    this.data = data;
  }
}

async function api<T>(action: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/ai/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new ApiError(response.status, data);
  return data as T;
}

function copyText(value: string) {
  return navigator.clipboard?.writeText(value).catch(() => undefined);
}

function euro(amount: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

/* ------------------------------------------------------------------ */
/* Composant principal                                                 */
/* ------------------------------------------------------------------ */

type Tab = "understand" | "write" | "translate" | "fill";

export function AssistantClient(props: {
  initialText: string;
  documentTitle?: string;
  documentId?: string;
  userName: string;
  aiMode: "anthropic" | "mock";
  quotas: {
    explanations: { remaining: number; limit: number; resetLabel: string };
    deep: { remaining: number; limit: number; resetLabel: string };
    emails: { remaining: number; limit: number; resetLabel: string };
    assisted: { remaining: number; limit: number; resetLabel: string };
  };
  credits: number;
  creditsEnabled: boolean;
}) {
  const [tab, setTab] = useState<Tab>("understand");
  const [text, setText] = useState(props.initialText);
  const [emailContext, setEmailContext] = useState(props.initialText);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="section-title">Assistant administratif</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Klerio vous répond en clair.</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-600 dark:text-ink-300">
            Comprendre, vérifier une arnaque, écrire, traduire, préparer un formulaire. Vous validez toujours.
          </p>
        </div>
        <Badge tone={props.aiMode === "anthropic" ? "success" : "warning"}>
          <Bot className="h-3.5 w-3.5" aria-hidden="true" />
          {props.aiMode === "anthropic" ? "IA connectée" : "Mode démonstration local"}
        </Badge>
      </div>

      {props.aiMode === "mock" && (
        <Alert tone="info" title="Démonstration sans clé Anthropic">
          Les analyses utilisent un moteur local (heuristiques et modèles de phrases). Ajoutez{" "}
          <code className="rounded bg-black/5 px-1 py-0.5 text-xs dark:bg-white/10">ANTHROPIC_API_KEY</code> dans{" "}
          <code className="rounded bg-black/5 px-1 py-0.5 text-xs dark:bg-white/10">.env</code> pour activer l'IA
          réelle. Aucun document ne quitte le serveur dans les deux cas.
        </Alert>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Fonctions de l'assistant">
        {[
          { id: "understand" as const, label: "Comprendre un document", icon: Sparkles },
          { id: "write" as const, label: "Écrire un courrier", icon: PenLine },
          { id: "translate" as const, label: "Traduire", icon: Languages },
          { id: "fill" as const, label: "Remplir un formulaire", icon: Wand2 }
        ].map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={tab === item.id ? "btn-primary shrink-0 px-3 text-xs" : "btn-secondary shrink-0 px-3 text-xs"}
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </div>

      {tab === "understand" && (
        <UnderstandTab
          text={text}
          setText={setText}
          quotas={props.quotas}
          credits={props.credits}
          creditsEnabled={props.creditsEnabled}
          documentTitle={props.documentTitle}
          documentId={props.documentId}
          onWrite={(context) => {
            setEmailContext(context);
            setTab("write");
          }}
          onTranslate={(value) => {
            setText(value);
            setTab("translate");
          }}
        />
      )}
      {tab === "write" && <WriteTab context={emailContext} setContext={setEmailContext} quotas={props.quotas} userName={props.userName} />}
      {tab === "translate" && <TranslateTab initialText={text} />}
      {tab === "fill" && (
        <FillTab initialText={text} quotas={props.quotas} credits={props.credits} creditsEnabled={props.creditsEnabled} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Comprendre                                                          */
/* ------------------------------------------------------------------ */

function UnderstandTab({
  text,
  setText,
  quotas,
  credits,
  creditsEnabled,
  documentTitle,
  documentId,
  onWrite,
  onTranslate
}: {
  text: string;
  setText: (value: string) => void;
  quotas: AssistantClientProps["quotas"];
  credits: number;
  creditsEnabled: boolean;
  documentTitle?: string;
  documentId?: string;
  onWrite: (context: string) => void;
  onTranslate: (value: string) => void;
}) {
  const [preview, setPreview] = useState<PreviewOutcome | null>(null);
  const [mode, setMode] = useState<"standard" | "deep">("standard");
  const [consentCredits, setConsentCredits] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<QuotaDecision | null>(null);
  const [outcome, setOutcome] = useState<AnalyzeOutcome | null>(null);
  const router = useRouter();

  const selectedDecision = preview ? (mode === "standard" ? preview.standard.decision : preview.deep.decision) : null;
  const needsConsent = Boolean(selectedDecision && !selectedDecision.allowed && selectedDecision.creditsCost > 0);
  const canRun = Boolean(
    selectedDecision &&
      (selectedDecision.allowed || (needsConsent && consentCredits && credits >= selectedDecision.creditsCost))
  );

  async function runPreview() {
    setLoading("preview");
    setError(null);
    setDecision(null);
    setOutcome(null);
    try {
      const result = await api<PreviewOutcome>("preview", {
        text,
        fileName: documentTitle,
        pageCount: preview?.deepPageCount
      });
      setPreview(result);
      setMode(result.detection.needsDeepAnalysis ? "deep" : "standard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de préparer l'analyse.");
    } finally {
      setLoading(null);
    }
  }

  async function analyze() {
    if (!preview) return;
    setLoading("analyze");
    setError(null);
    setDecision(null);
    try {
      const result = await api<AnalyzeOutcome>("analyze", {
        text,
        fileName: documentTitle,
        mode,
        pageCount: preview.deepPageCount,
        allowCredits: consentCredits
      });
      setOutcome(result);
      setPreview(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.data.decision) setDecision(err.data.decision as QuotaDecision);
        if (err.data.code === "deep_required" && err.data.detection) {
          setPreview((prev) =>
            prev
              ? { ...prev, detection: err.data.detection as Detection }
              : prev
          );
          setMode("deep");
        }
      } else {
        setError("L'analyse a échoué. Réessayez.");
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
      <Card className="self-start">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">Le document ou le message</h2>
          {documentId && <Badge tone="brand">Depuis le coffre</Badge>}
        </div>
        <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
          Collez le texte d'un courrier, d'un e-mail ou d'un document. Pour une photo, ajoutez son texte dans le
          coffre-fort ou copiez-le ici.
        </p>
        <label htmlFor="analyze-text" className="label mt-4">
          Texte à comprendre
        </label>
        <textarea
          id="analyze-text"
          className="textarea min-h-[240px]"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setPreview(null);
            setOutcome(null);
          }}
          placeholder={"Exemple :\n« Madame, Monsieur, à la suite du contrôle de votre situation, nous vous informons qu'une pièce est manquante. Vous devez la transmettre avant le 15 décembre 2026… »"}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={runPreview} className="btn-primary" disabled={loading !== null || text.trim().length < 20}>
            {loading === "preview" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ScanIcon />}
            Vérifier le type et le coût
          </button>
          {documentId && (
            <Link href={`/app/vault/${documentId}`} className="btn-ghost text-xs">
              <FileText className="h-4 w-4" aria-hidden="true" /> Voir le document
            </Link>
          )}
        </div>
        <p className="hint mt-2">
          Klerio affiche toujours le type détecté et le quota consommé <strong>avant</strong> de lancer l'analyse.
        </p>

        <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-xl border border-ink-200 p-3 dark:border-ink-800">
            <p className="font-bold">Explications</p>
            <p className="mt-1 text-ink-500 dark:text-ink-400">
              {quotas.explanations.remaining} / {quotas.explanations.limit} · {quotas.explanations.resetLabel}
            </p>
          </div>
          <div className="rounded-xl border border-ink-200 p-3 dark:border-ink-800">
            <p className="font-bold">Analyse approfondie</p>
            <p className="mt-1 text-ink-500 dark:text-ink-400">
              {quotas.deep.remaining} / {quotas.deep.limit} pages · {quotas.deep.resetLabel}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4">
            <Alert tone="danger" title="Action impossible">{error}</Alert>
          </div>
        )}

        {decision && (
          <DecisionBox decision={decision} onCredits={() => setConsentCredits(true)} allowCredits={creditsEnabled} />
        )}

        {preview && (
          <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/60 p-4 dark:border-brand-800 dark:bg-brand-950/30">
            <p className="text-sm font-bold">Type détecté : {preview.detection.documentType}</p>
            <p className="mt-1 text-xs text-ink-600 dark:text-ink-300">{preview.detection.reason}</p>
            <div className="mt-3 space-y-2">
              <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${mode === "standard" ? "border-brand-500 bg-white dark:bg-ink-900" : "border-ink-200 dark:border-ink-700"}`}>
                <input type="radio" name="mode" checked={mode === "standard"} onChange={() => setMode("standard")} className="mt-0.5" disabled={preview.detection.needsDeepAnalysis} />
                <span>
                  <span className="font-bold">Analyse standard</span>
                  <span className="block text-xs text-ink-500 dark:text-ink-400">
                    {preview.standard.decision.includedRemaining} explication(s) restante(s). 1 explication suffit pour ce document.
                  </span>
                </span>
              </label>
              <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${mode === "deep" ? "border-brand-500 bg-white dark:bg-ink-900" : "border-ink-200 dark:border-ink-700"}`}>
                <input type="radio" name="mode" checked={mode === "deep"} onChange={() => setMode("deep")} className="mt-0.5" />
                <span>
                  <span className="font-bold">Analyse approfondie</span>
                  <span className="block text-xs text-ink-500 dark:text-ink-400">
                    {preview.deepPageCount} page(s) · {preview.deep.decision.includedRemaining} page(s) restante(s). Documents juridiques ou complexes.
                  </span>
                </span>
              </label>
            </div>
            {preview.detection.needsDeepAnalysis && (
              <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                Ce document est juridique ou complexe : l'analyse approfondie est obligatoire.
              </p>
            )}
            {selectedDecision && (
              <div className="mt-3 rounded-lg bg-white/80 p-3 text-xs text-ink-700 dark:bg-ink-900 dark:text-ink-200">
                <p>{selectedDecision.message}</p>
                {selectedDecision.creditsCost > 0 && (
                  <p className="mt-1 font-semibold">
                    Coût en crédits : {selectedDecision.creditsCost} · solde : {selectedDecision.creditBalance}
                  </p>
                )}
                {needsConsent && (
                  <label className="mt-2 flex items-start gap-2">
                    <input type="checkbox" checked={consentCredits} onChange={(e) => setConsentCredits(e.target.checked)} className="mt-0.5" />
                    <span>J'accepte d'utiliser {selectedDecision.creditsCost} crédits pour cette analyse. Aucun prélèvement automatique.</span>
                  </label>
                )}
              </div>
            )}
            <button type="button" onClick={analyze} className="btn-primary mt-3 w-full" disabled={loading !== null || !canRun}>
              {loading === "analyze" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
              {loading === "analyze" ? "Analyse en cours…" : "Lancer l'analyse"}
            </button>
            {!canRun && selectedDecision && !selectedDecision.allowed && !needsConsent && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                Quota insuffisant. Attendez le renouvellement, achetez des crédits ou changez de forfait.
              </p>
            )}
          </div>
        )}
      </Card>

      <div className="space-y-4">
        {!outcome && (
          <Card className="border-dashed">
            <div className="py-10 text-center">
              <ShieldCheck className="mx-auto h-10 w-10 text-brand-500" aria-hidden="true" />
              <p className="mt-3 font-bold">Rien n'est envoyé à une administration.</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500 dark:text-ink-400">
                Klerio lit, explique et prépare. Vous gardez le contrôle à chaque étape. Aucun paiement ni clic à
                votre place.
              </p>
            </div>
          </Card>
        )}

        {outcome && (
          <>
            {(outcome.degraded || outcome.provider !== "anthropic") && (
              <Alert tone="info" title="Analyse locale de démonstration">
                Le résultat est produit par les heuristiques Klerio. Il peut manquer de nuance. Ajoutez une clé
                Anthropic pour une analyse réelle.
              </Alert>
            )}
            <ScamCard scam={outcome.analysis.scam} />
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="section-title">En résumé</p>
                  <h2 className="mt-1 text-xl font-black">{outcome.analysis.title}</h2>
                </div>
                <Badge tone="brand">{outcome.mode === "deep" ? "Analyse approfondie" : "Analyse standard"}</Badge>
              </div>
              <p className="prose-simple mt-3">{outcome.analysis.summary}</p>
              {outcome.analysis.keyPoints.length > 0 && (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {outcome.analysis.keyPoints.map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-ink-500 dark:text-ink-400">
                Quota consommé : {outcome.quota.fromIncluded ?? 0} inclus
                {outcome.quota.fromCredits ? ` + ${outcome.quota.fromCredits} crédits` : ""}.{" "}
                {outcome.analysis.confidence < 0.6 && "Confiance limitée : vérifiez le document original."}
              </p>
            </Card>

            {outcome.analysis.actions.length > 0 && (
              <Card>
                <p className="section-title">Ce que vous devez faire</p>
                <ol className="mt-3 space-y-3">
                  {outcome.analysis.actions.map((action, index) => (
                    <li key={`${action.title}-${index}`} className="flex gap-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white dark:bg-brand-400 dark:text-ink-950">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-bold">
                          {action.title}
                          {action.mandatory && <span className="ml-2 text-[0.65rem] font-bold uppercase text-amber-700 dark:text-amber-300">Obligatoire</span>}
                        </p>
                        <p className="mt-0.5 text-sm text-ink-600 dark:text-ink-300">{action.detail}</p>
                        {action.dueDate && (
                          <p className="mt-1 text-xs font-semibold text-ink-500 dark:text-ink-400">
                            À faire avant le {formatDate(action.dueDate)}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => onWrite(`Bonjour,\n\n${outcome.analysis.summary}\n\nJe vous remercie de bien vouloir traiter ma demande.`)}
                  >
                    <PenLine className="h-4 w-4" aria-hidden="true" /> Rédiger un courrier
                  </button>
                  <button type="button" className="btn-secondary text-xs" onClick={() => onTranslate(outcome.analysis.summary)}>
                    <Languages className="h-4 w-4" aria-hidden="true" /> Traduire le résumé
                  </button>
                  {documentId && (
                    <Link
                      href={`/app/reminders?document=${documentId}&title=${encodeURIComponent(`Penser à : ${outcome.analysis.title}`)}`}
                      className="btn-secondary text-xs"
                    >
                      Créer un rappel
                    </Link>
                  )}
                </div>
              </Card>
            )}

            {(outcome.analysis.dates.length > 0 || outcome.analysis.amounts.length > 0) && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Card>
                  <p className="section-title">Dates</p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {outcome.analysis.dates.map((date, index) => (
                      <li key={`${date.label}-${index}`} className="flex items-center justify-between gap-2">
                        <span className="text-ink-600 dark:text-ink-300">{date.label}</span>
                        <span className="shrink-0 font-semibold">{date.date ? formatDate(date.date) : "—"}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card>
                  <p className="section-title">Montants</p>
                  {outcome.analysis.amounts.length === 0 ? (
                    <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">Aucun montant identifié.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {outcome.analysis.amounts.map((amount, index) => (
                        <li key={`${amount.label}-${index}`} className="flex items-center justify-between gap-2">
                          <span className="text-ink-600 dark:text-ink-300">{amount.label}</span>
                          <span className="shrink-0 font-semibold">{euro(amount.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            )}

            {outcome.officialLink && (
              <Card className="border-brand-200 bg-brand-50/60 dark:border-brand-800 dark:bg-brand-950/20">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-bold">Lien officiel vérifié</p>
                    <p className="mt-0.5 text-xs text-ink-600 dark:text-ink-300">
                      Klerio ne génère pas d'URL. Ce lien provient de sa liste contrôlée.
                    </p>
                    <a
                      href={outcome.officialLink.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="btn-secondary mt-2 text-xs"
                    >
                      {outcome.officialLink.label}
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </Card>
            )}

            {outcome.analysis.risks.length > 0 && (
              <Card>
                <p className="section-title">Points de vigilance</p>
                <ul className="mt-2 space-y-1.5 text-sm text-ink-700 dark:text-ink-200">
                  {outcome.analysis.risks.map((risk) => (
                    <li key={risk} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                      {risk}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <p className="rounded-xl border border-ink-200 p-3 text-xs leading-relaxed text-ink-500 dark:border-ink-800 dark:text-ink-400">
              {outcome.analysis.disclaimer ||
                "Klerio vous aide à comprendre. Il ne remplace pas un avocat, un notaire ou un comptable."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function ScanIcon() {
  return <Sparkles className="h-4 w-4" aria-hidden="true" />;
}

function ScamCard({ scam }: { scam: Analysis["scam"] }) {
  const tone = scam.level === "high" ? "danger" : scam.level === "medium" ? "warning" : "success";
  return (
    <section
      className={`rounded-2xl border p-4 ${
        scam.level === "high"
          ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
          : scam.level === "medium"
            ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
            : "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
      }`}
      aria-label="Évaluation du risque d'arnaque"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-bold">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          {scam.level === "high" ? "Risque élevé d'arnaque" : scam.level === "medium" ? "Vigilance recommandée" : "Aucun signal fort détecté"}
        </p>
        <Badge tone={tone}>Risque {scam.score}/100 · confiance {Math.round(scam.confidence * 100)} %</Badge>
      </div>
      <div className="mt-2">
        <Progress value={scam.score} tone={scam.level === "high" ? "danger" : scam.level === "medium" ? "warning" : "brand"} label="Indice de risque" />
      </div>
      <p className="mt-2 text-sm font-semibold">{scam.recommendation}</p>
      {scam.signals.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {scam.signals.map((signal) => (
            <li key={signal.label}>
              <strong>{signal.label}</strong>
              {signal.detail ? ` — ${signal.detail}` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DecisionBox({
  decision,
  onCredits,
  allowCredits
}: {
  decision: QuotaDecision;
  onCredits: () => void;
  allowCredits: boolean;
}) {
  return (
    <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="font-bold">Quota ou crédits insuffisants</p>
      <p className="mt-1">{decision.message}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {decision.alternatives.map((alt) => (
          <span key={alt.code} className="chip border-amber-300 bg-white/60 text-[0.7rem] dark:bg-ink-900/60" title={alt.detail}>
            {alt.label}
          </span>
        ))}
      </div>
      {allowCredits && decision.creditsCost > 0 && decision.creditBalance >= decision.creditsCost && (
        <button type="button" className="btn-secondary mt-2 text-xs" onClick={onCredits}>
          J'accepte d'utiliser {decision.creditsCost} crédits
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Écrire                                                              */
/* ------------------------------------------------------------------ */

function WriteTab({
  context,
  setContext,
  quotas,
  userName
}: {
  context: string;
  setContext: (value: string) => void;
  quotas: AssistantClientProps["quotas"];
  userName: string;
}) {
  const [kind, setKind] = useState("reclamation");
  const [tone, setTone] = useState("courtois");
  const [recipient, setRecipient] = useState("");
  const [subjectHint, setSubjectHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<QuotaDecision | null>(null);
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  async function generate() {
    setLoading(true);
    setError(null);
    setDecision(null);
    try {
      const result = await api<{ draft: EmailDraft; quota: QuotaDecision; degraded: boolean }>("email", {
        kind,
        tone,
        recipient,
        subjectHint,
        context,
        senderName: userName
      });
      setDraft(result.draft);
      setBody(result.draft.body);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.data.decision) setDecision(err.data.decision as QuotaDecision);
      } else {
        setError("La génération a échoué.");
      }
    } finally {
      setLoading(false);
    }
  }

  const mailto = draft ? `mailto:?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(body)}` : "#";

  return (
    <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <h2 className="font-bold">Votre situation</h2>
        <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
          Décrivez avec vos mots. Klerio rédige un courrier que vous relisez et envoyez vous-même.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="kind" className="label">Type de courrier</label>
            <select id="kind" className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="reclamation">Réclamation</option>
              <option value="contestation">Contestation</option>
              <option value="demande">Demande</option>
              <option value="relance">Relance</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div>
            <label htmlFor="tone" className="label">Ton</label>
            <select id="tone" className="select" value={tone} onChange={(e) => setTone(e.target.value)}>
              <option value="courtois">Courtois</option>
              <option value="formel">Formel</option>
              <option value="ferme">Ferme</option>
            </select>
          </div>
        </div>
        <div className="mt-3">
          <label htmlFor="recipient" className="label">Destinataire <span className="font-normal text-ink-400">(facultatif)</span></label>
          <input id="recipient" className="input" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Ex. Monsieur le directeur de la CAF" />
        </div>
        <div className="mt-3">
          <label htmlFor="subject" className="label">Objet souhaité <span className="font-normal text-ink-400">(facultatif)</span></label>
          <input id="subject" className="input" value={subjectHint} onChange={(e) => setSubjectHint(e.target.value)} placeholder="Ex. Contestation d'un trop-perçu" />
        </div>
        <div className="mt-3">
          <label htmlFor="context" className="label">Ce que vous voulez dire</label>
          <textarea
            id="context"
            className="textarea min-h-[200px]"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Expliquez la situation, les dates et ce que vous demandez. Ne mettez pas de données sensibles inutiles."
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-ink-500 dark:text-ink-400">
          <span>{quotas.emails.remaining} / {quotas.emails.limit} e-mails restants cette semaine</span>
          <span>{quotas.emails.resetLabel}</span>
        </div>
        {error && <div className="mt-3"><Alert tone="danger" title="Impossible de générer le courrier">{error}</Alert></div>}
        {decision && <DecisionBox decision={decision} onCredits={() => undefined} allowCredits={false} />}
        <button type="button" className="btn-primary mt-4 w-full" onClick={generate} disabled={loading || context.trim().length < 20}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <PenLine className="h-4 w-4" aria-hidden="true" />}
          {loading ? "Rédaction…" : "Rédiger le courrier"}
        </button>
        <p className="hint mt-2">Aucun envoi automatique. Vous copiez le texte ou l'ouvrez dans votre messagerie.</p>
      </Card>

      <div className="space-y-4">
        {!draft ? (
          <Card className="border-dashed">
            <div className="py-10 text-center">
              <Mail className="mx-auto h-10 w-10 text-brand-500" aria-hidden="true" />
              <p className="mt-3 font-bold">Le courrier apparaîtra ici.</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500 dark:text-ink-400">
                Vous pourrez le modifier, le copier ou l'envoyer depuis votre boîte mail.
              </p>
            </div>
          </Card>
        ) : (
          <>
            <Card>
              <div className="flex items-center justify-between gap-2">
                <p className="section-title">Objet</p>
                <Badge tone="brand">{draft.tone}</Badge>
              </div>
              <p className="mt-1 font-bold">{draft.subject}</p>
              <label htmlFor="draft-body" className="label mt-3">Corps du courrier</label>
              <textarea id="draft-body" className="textarea min-h-[340px] font-mono text-xs" value={body} onChange={(e) => setBody(e.target.value)} />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={async () => {
                    await copyText(body);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                  {copied ? "Copié" : "Copier le texte"}
                </button>
                <a href={mailto} className="btn-secondary text-xs">
                  <Mail className="h-4 w-4" aria-hidden="true" /> Ouvrir dans ma messagerie
                </a>
              </div>
            </Card>
            {draft.warnings.length > 0 && (
              <Card>
                <p className="section-title">Avant d'envoyer</p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {draft.warnings.map((warning) => (
                    <li key={warning} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                      {warning}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Traduire                                                            */
/* ------------------------------------------------------------------ */

function TranslateTab({ initialText }: { initialText: string }) {
  const [text, setText] = useState(initialText);
  const [target, setTarget] = useState("Anglais");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<TranslationOutcome | null>(null);
  const [copied, setCopied] = useState(false);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const result = await api<TranslationOutcome>("translate", { text, targetLanguage: target });
      setOutcome(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Traduction impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">Texte à traduire</h2>
          <Badge tone="success">Gratuit · sans quota</Badge>
        </div>
        <label htmlFor="translate-text" className="label mt-4">Texte</label>
        <textarea id="translate-text" className="textarea min-h-[260px]" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="mt-3">
          <label htmlFor="target" className="label">Langue cible</label>
          <select id="target" className="select" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option>Anglais</option>
            <option>Espagnol</option>
            <option>Portugais</option>
            <option>Arabe</option>
            <option>Turc</option>
            <option>Français</option>
          </select>
        </div>
        {error && <div className="mt-3"><Alert tone="danger" title="Traduction impossible">{error}</Alert></div>}
        <button type="button" onClick={run} className="btn-primary mt-4 w-full" disabled={loading || text.trim().length < 20}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Languages className="h-4 w-4" aria-hidden="true" />}
          {loading ? "Traduction…" : "Traduire"}
        </button>
        <p className="hint mt-2">La traduction est gratuite et sans quota pour tous les forfaits. Elle n'est pas assermentée.</p>
      </Card>
      <Card>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">Traduction</h2>
          {outcome && (
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={async () => {
                await copyText(outcome.result.translatedText);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copied ? "Copié" : "Copier"}
            </button>
          )}
        </div>
        {!outcome ? (
          <p className="mt-6 text-sm text-ink-500 dark:text-ink-400">La traduction apparaîtra ici.</p>
        ) : (
          <>
            {outcome.degraded && (
              <Alert tone="info" title="Traduction de démonstration">
                Ajoutez une clé Anthropic pour une traduction réelle. Le texte est resté sur le serveur Klerio.
              </Alert>
            )}
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{outcome.result.translatedText}</p>
            {outcome.result.notes.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-ink-500 dark:text-ink-400">
                {outcome.result.notes.map((note) => <li key={note}>• {note}</li>)}
              </ul>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Remplir                                                             */
/* ------------------------------------------------------------------ */

function FillTab({
  initialText,
  quotas,
  credits,
  creditsEnabled
}: {
  initialText: string;
  quotas: AssistantClientProps["quotas"];
  credits: number;
  creditsEnabled: boolean;
}) {
  const [text, setText] = useState(initialText);
  const [formName, setFormName] = useState("");
  const [mode, setMode] = useState<"assisted" | "autofill">("assisted");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<FillOutcome | null>(null);
  const router = useRouter();

  const autofillCost = 30;
  const canAutofill = creditsEnabled && credits >= autofillCost && consent;
  const assistedAvailable = quotas.assisted.limit > 0 && quotas.assisted.remaining > 0;
  const canRun = mode === "assisted" ? assistedAvailable : canAutofill;

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const result = await api<FillOutcome>("fill", {
        text,
        formName,
        mode,
        allowCredits: mode === "autofill" ? consent : true
      });
      setOutcome(result);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Préparation impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <h2 className="font-bold">Quel formulaire ?</h2>
        <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
          Klerio prépare les champs, vérifie la cohérence et vous ouvre le site officiel. Il ne soumet rien.
        </p>
        <label htmlFor="formName" className="label mt-4">Nom de la démarche <span className="font-normal text-ink-400">(facultatif)</span></label>
        <input id="formName" className="input" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex. Demande d'aide au logement" />
        <label htmlFor="fill-text" className="label mt-3">Informations disponibles</label>
        <textarea
          id="fill-text"
          className="textarea min-h-[200px]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Collez le courrier, les informations personnelles utiles, les pièces demandées…"
        />
        <fieldset className="mt-4">
          <legend className="label">Mode</legend>
          <div className="space-y-2">
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${mode === "assisted" ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/20" : "border-ink-200 dark:border-ink-800"}`}>
              <input type="radio" name="fill-mode" checked={mode === "assisted"} onChange={() => setMode("assisted")} className="mt-0.5" />
              <span>
                <span className="font-bold">Remplissage assisté</span>
                <span className="block text-xs text-ink-500 dark:text-ink-400">
                  Klerio pose des questions et prépare les champs. {quotas.assisted.remaining} / {quotas.assisted.limit} inclus ce mois.
                </span>
              </span>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${mode === "autofill" ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/20" : "border-ink-200 dark:border-ink-800"}`}>
              <input type="radio" name="fill-mode" checked={mode === "autofill"} onChange={() => setMode("autofill")} className="mt-0.5" />
              <span>
                <span className="font-bold">Remplissage automatique complet</span>
                <span className="block text-xs text-ink-500 dark:text-ink-400">
                  Fonction payante : {autofillCost} crédits ({euro(autofillCost / 10)}). Toujours précédé d'un récapitulatif à valider.
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        {mode === "autofill" && (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-bold">Récapitulatif avant débit</p>
            <p className="mt-1">
              {autofillCost} crédits seront débités de votre solde ({credits} crédits). Aucun formulaire ne sera envoyé :
              vous validerez le récapitulatif et cliquerez vous-même sur le site officiel.
            </p>
            <label className="mt-2 flex items-start gap-2">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
              <span>Je comprends et j'accepte ce débit unique de {autofillCost} crédits.</span>
            </label>
            {(!creditsEnabled || credits < autofillCost) && (
              <p className="mt-2 text-xs font-semibold">
                Crédits insuffisants. Achetez un complément ou utilisez le remplissage assisté.
              </p>
            )}
          </div>
        )}

        {mode === "assisted" && !assistedAvailable && (
          <div className="mt-3">
            <Alert tone="warning" title="Remplissage assisté non inclus">
              Votre forfait ne comprend pas (ou plus) de remplissage assisté ce mois-ci. Passez à Pro pour en
              bénéficier, ou utilisez le remplissage automatique avec des crédits.
              <Link href="/app/billing" className="link ml-1">Voir les forfaits</Link>
            </Alert>
          </div>
        )}
        {error && <div className="mt-3"><Alert tone="danger" title="Préparation impossible">{error}</Alert></div>}
        <button
          type="button"
          className="btn-primary mt-4 w-full"
          onClick={run}
          disabled={loading || text.trim().length < 20 || !canRun}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Wand2 className="h-4 w-4" aria-hidden="true" />}
          {loading ? "Préparation…" : "Préparer mon formulaire"}
        </button>
      </Card>

      <div className="space-y-4">
        {!outcome ? (
          <Card className="border-dashed">
            <div className="py-10 text-center">
              <Wand2 className="mx-auto h-10 w-10 text-brand-500" aria-hidden="true" />
              <p className="mt-3 font-bold">Le récapitulatif apparaîtra ici.</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500 dark:text-ink-400">
                Vous pourrez vérifier chaque champ avant de continuer sur le site officiel.
              </p>
            </div>
          </Card>
        ) : (
          <>
            <Card>
              <div className="flex items-center justify-between gap-2">
                <p className="section-title">Récapitulatif</p>
                {outcome.quota && <Badge tone="brand">{outcome.quota.fromCredits ? `${outcome.quota.creditsCost} crédits` : "Quota inclus"}</Badge>}
                {!outcome.quota && <Badge tone="warning">{autofillCost} crédits</Badge>}
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Champs préparés par Klerio</caption>
                  <thead>
                    <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500 dark:border-ink-800 dark:text-ink-400">
                      <th className="py-2 pr-2">Champ</th>
                      <th className="py-2">Valeur / question</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outcome.result.fields.map((field) => (
                      <tr key={field.key} className="border-b border-ink-100 align-top dark:border-ink-800">
                        <td className="py-2 pr-2 font-semibold">{field.label}</td>
                        <td className="py-2">
                          {field.value ? field.value : <span className="text-amber-700 dark:text-amber-300">{field.question ?? "À compléter"}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {outcome.result.steps.length > 0 && (
                <ol className="mt-4 space-y-2 text-sm">
                  {outcome.result.steps.map((step, index) => (
                    <li key={step} className="flex gap-2">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white dark:bg-brand-400 dark:text-ink-950">{index + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              )}
              {outcome.officialLink && (
                <a
                  href={outcome.officialLink.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="btn-secondary mt-4 text-xs"
                >
                  Continuer sur {outcome.officialLink.label} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
              <p className="mt-3 text-xs leading-relaxed text-ink-500 dark:text-ink-400">{outcome.result.disclaimer}</p>
            </Card>
            {outcome.result.missing.length > 0 && (
              <Alert tone="warning" title="Informations à compléter">
                {outcome.result.missing.join(", ")}
              </Alert>
            )}
          </>
        )}
      </div>
    </div>
  );
}

type AssistantClientProps = {
  quotas: {
    explanations: { remaining: number; limit: number; resetLabel: string };
    deep: { remaining: number; limit: number; resetLabel: string };
    emails: { remaining: number; limit: number; resetLabel: string };
    assisted: { remaining: number; limit: number; resetLabel: string };
  };
};
