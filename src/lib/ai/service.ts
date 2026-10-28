import "server-only";
import { getOfficialLinks, safeOfficialLink } from "@/lib/official-links";
import { OFFICIAL_LINKS, isOfficialDomain } from "@/lib/official-links-data";
import { isValidCategory } from "@/lib/categories";
import {
  AUTOFILL_CREDIT_COST,
  type QuotaType
} from "@/lib/quota/plans";
import {
  consumeCredits,
  consumeQuota,
  logAiRequest,
  previewQuota,
  refundUsage,
  type QuotaDecision
} from "@/lib/quota/service";
import { analysisSchema, emailSchema, fillSchema, translationSchema, type AnalysisResult, type DetectionResult, type EmailDraft, type FillResult, type TranslationResult } from "./schemas";
import { mockAnalysis, mockDetect, mockEmail, mockFill, mockTranslation } from "./mock";
import { AiUnavailableError, completeWithClaude, extractJson } from "./provider";
import {
  EMAIL_SYSTEM,
  FILL_SYSTEM,
  KLERIO_ANALYST_SYSTEM,
  TRANSLATION_SYSTEM,
  analysisUserPrompt,
  emailUserPrompt,
  fillUserPrompt
} from "./prompts";
import { aiEnabled } from "@/lib/env";

const MAX_TEXT = 20_000;

const CATEGORY_TO_SLUG: Record<string, string> = {
  impots: "impots-particulier",
  logement: "anil",
  sante: "ameli",
  travail: "francetravail",
  banque: "service-public-particuliers",
  assurance: "service-public-particuliers",
  famille: "caf",
  papiers: "ants",
  justice: "legifrance",
  consommation: "economie",
  loisirs: "service-public-particuliers",
  autre: "service-public-particuliers"
};

export class DeepAnalysisRequiredError extends Error {
  constructor(readonly detection: DetectionResult) {
    super("Ce document nécessite une analyse approfondie.");
    this.name = "DeepAnalysisRequiredError";
  }
}

export class AiInputError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "AiInputError";
  }
}

export function aiStatus(): { enabled: boolean; mode: "anthropic" | "mock" } {
  return { enabled: aiEnabled, mode: aiEnabled ? "anthropic" : "mock" };
}

function cleanInput(text: string): string {
  const cleaned = text.replace(/\u0000/g, "").trim();
  if (cleaned.length < 20) {
    throw new AiInputError("Le texte est trop court. Ajoutez au moins quelques phrases pour une analyse utile.");
  }
  return cleaned.slice(0, MAX_TEXT);
}

function stripUnknownUrls(value: string): string {
  return value.replace(/https?:\/\/[^\s<>"')]+/gi, (url) => {
    try {
      return isOfficialDomain(new URL(url).hostname) ? url : "[lien retiré]";
    } catch {
      return "[lien retiré]";
    }
  });
}

function sanitizeAnalysis(input: AnalysisResult): AnalysisResult {
  const categorySlug = isValidCategory(input.categorySlug) ? input.categorySlug : "autre";
  return {
    ...input,
    categorySlug,
    summary: stripUnknownUrls(input.summary),
    keyPoints: input.keyPoints.map(stripUnknownUrls),
    actions: input.actions.map((a) => ({
      ...a,
      title: stripUnknownUrls(a.title),
      detail: stripUnknownUrls(a.detail)
    })),
    risks: input.risks.map(stripUnknownUrls),
    scam: {
      ...input.scam,
      signals: input.scam.signals.map((s) => ({ label: stripUnknownUrls(s.label), detail: stripUnknownUrls(s.detail ?? "") })),
      recommendation: stripUnknownUrls(input.scam.recommendation)
    }
  };
}

async function linkCatalog() {
  const dbLinks = await getOfficialLinks();
  if (dbLinks.length > 0) {
    return dbLinks.map((l) => ({ slug: l.slug, label: l.label, category: l.category, url: l.url }));
  }
  return OFFICIAL_LINKS.map((l) => ({ slug: l.slug, label: l.label, category: l.category, url: l.url }));
}

async function resolveLink(slug: string | null | undefined, categorySlug: string) {
  const direct = await safeOfficialLink(slug);
  if (direct) return direct;
  const fallback = CATEGORY_TO_SLUG[categorySlug] ?? "service-public-particuliers";
  return safeOfficialLink(fallback);
}

export interface AnalysisOutcome {
  analysis: AnalysisResult;
  detection: DetectionResult;
  quota: QuotaDecision;
  mode: "standard" | "deep";
  pageCount: number;
  degraded: boolean;
  provider: "anthropic" | "mock";
  officialLink: { slug: string; label: string; url: string } | null;
}

export interface AnalysisPreview {
  detection: DetectionResult;
  standard: { decision: QuotaDecision; credits: number };
  deep: { decision: QuotaDecision; credits: number };
  deepPageCount: number;
}

export async function previewAnalysis(input: {
  userId: string;
  text: string;
  fileName?: string;
  pageCount?: number;
}): Promise<AnalysisPreview> {
  const text = input.text.trim();
  const detection = mockDetect(text, input.fileName ?? "");
  const pageCount = Math.max(1, Math.min(50, input.pageCount ?? detection.estimatedPages));
  const [standard, deep] = await Promise.all([
    previewQuota({ userId: input.userId, type: "explanations", quantity: 1 }),
    previewQuota({ userId: input.userId, type: "deep_analysis_pages", quantity: pageCount })
  ]);
  return {
    detection,
    standard: { decision: standard.decision, credits: standard.credits },
    deep: { decision: deep.decision, credits: deep.credits },
    deepPageCount: pageCount
  };
}

export async function analyzeDocument(input: {
  userId: string;
  text: string;
  fileName?: string;
  mode: "standard" | "deep";
  pageCount?: number;
  allowCredits?: boolean;
}): Promise<AnalysisOutcome> {
  const text = cleanInput(input.text);
  const detection = mockDetect(text, input.fileName ?? "");

  if (detection.needsDeepAnalysis && input.mode !== "deep") {
    throw new DeepAnalysisRequiredError(detection);
  }

  const quotaType: QuotaType = input.mode === "deep" ? "deep_analysis_pages" : "explanations";
  const pageCount = input.mode === "deep" ? Math.max(1, Math.min(50, input.pageCount ?? 1)) : 1;
  const consumption = await consumeQuota({
    userId: input.userId,
    type: quotaType,
    quantity: pageCount,
    allowCredits: input.allowCredits,
    note: "analyse de document"
  });

  const started = Date.now();
  const links = await linkCatalog();
  let analysis: AnalysisResult;
  let degraded = false;
  let provider: "anthropic" | "mock" = "mock";
  let outputTokens = 0;
  let costMicros = 0;
  let inputChars = text.length;

  if (!aiEnabled) {
    analysis = mockAnalysis(text, detection);
    degraded = true;
  } else {
    try {
      const completion = await completeWithClaude({
        system: KLERIO_ANALYST_SYSTEM,
        user: analysisUserPrompt({ text, fileName: input.fileName, detection, links }),
        maxTokens: 2400
      });
      analysis = analysisSchema.parse(extractJson(completion.text));
      provider = "anthropic";
      outputTokens = completion.outputTokens;
      costMicros = completion.costMicros;
      inputChars = completion.inputChars;
    } catch {
      // L'appel a échoué : on rembourse le quota et on bascule sur le moteur local.
      await refundUsage(consumption.usageId).catch(() => undefined);
      analysis = mockAnalysis(text, detection);
      degraded = true;
    }
  }

  analysis = sanitizeAnalysis(analysis);
  analysis.needsDeepAnalysis = detection.needsDeepAnalysis || analysis.needsDeepAnalysis;
  const officialLink = await resolveLink(analysis.officialLinkSlug, analysis.categorySlug);
  analysis.officialLinkSlug = officialLink?.slug ?? null;
  if (degraded) {
    analysis.risks = [
      ...analysis.risks,
      "Analyse produite par le moteur local de démonstration : ajoutez une clé Anthropic pour une compréhension plus fine."
    ].slice(0, 10);
  }

  await logAiRequest({
    userId: input.userId,
    type: input.mode === "deep" ? "deep_analyze" : "analyze",
    model: provider === "anthropic" ? "claude" : "klerio-mock",
    provider,
    inputChars,
    outputTokens,
    costMicros,
    quotaType,
    quotaDebited: consumption.decision.fromIncluded,
    creditsDebited: consumption.decision.creditsCost,
    latencyMs: Date.now() - started,
    metadata: { degraded, pageCount, category: analysis.categorySlug }
  }).catch(() => undefined);

  return {
    analysis,
    detection,
    quota: consumption.decision,
    mode: input.mode,
    pageCount,
    degraded,
    provider,
    officialLink: officialLink ? { slug: officialLink.slug, label: officialLink.label, url: officialLink.url } : null
  };
}

/* ------------------------------------------------------------------ */
/* E-mails                                                             */
/* ------------------------------------------------------------------ */

export interface EmailOutcome {
  draft: EmailDraft;
  quota: QuotaDecision;
  degraded: boolean;
  provider: "anthropic" | "mock";
}

export async function generateEmail(input: {
  userId: string;
  kind: string;
  tone: string;
  recipient?: string;
  subjectHint?: string;
  context: string;
  senderName?: string;
  allowCredits?: boolean;
}): Promise<EmailOutcome> {
  const context = cleanInput(input.context);
  const consumption = await consumeQuota({
    userId: input.userId,
    type: "email_generations",
    quantity: 1,
    allowCredits: input.allowCredits,
    note: "génération de courrier"
  });

  const started = Date.now();
  let draft: EmailDraft;
  let degraded = false;
  let provider: "anthropic" | "mock" = "mock";
  let outputTokens = 0;
  let costMicros = 0;

  if (!aiEnabled) {
    draft = mockEmail({ ...input, context });
    degraded = true;
  } else {
    try {
      const completion = await completeWithClaude({
        system: EMAIL_SYSTEM,
        user: emailUserPrompt({ ...input, context }),
        maxTokens: 1800
      });
      draft = emailSchema.parse(extractJson(completion.text));
      provider = "anthropic";
      outputTokens = completion.outputTokens;
      costMicros = completion.costMicros;
    } catch {
      await refundUsage(consumption.usageId).catch(() => undefined);
      draft = mockEmail({ ...input, context });
      degraded = true;
    }
  }

  draft.subject = stripUnknownUrls(draft.subject).slice(0, 200);
  draft.body = stripUnknownUrls(draft.body).slice(0, 6000);

  await logAiRequest({
    userId: input.userId,
    type: "email",
    model: provider === "anthropic" ? "claude" : "klerio-mock",
    provider,
    inputChars: context.length,
    outputTokens,
    costMicros,
    quotaType: "email_generations",
    quotaDebited: consumption.decision.fromIncluded,
    creditsDebited: consumption.decision.creditsCost,
    latencyMs: Date.now() - started,
    metadata: { kind: input.kind, tone: input.tone, degraded }
  }).catch(() => undefined);

  return { draft, quota: consumption.decision, degraded, provider };
}

/* ------------------------------------------------------------------ */
/* Traduction (gratuite, sans quota)                                   */
/* ------------------------------------------------------------------ */

export async function translateText(input: {
  userId: string;
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
}): Promise<{ result: TranslationResult; degraded: boolean; provider: "anthropic" | "mock" }> {
  const text = cleanInput(input.text).slice(0, 12_000);
  const target = input.targetLanguage.slice(0, 40);
  const started = Date.now();
  let result: TranslationResult;
  let degraded = false;
  let provider: "anthropic" | "mock" = "mock";
  let outputTokens = 0;
  let costMicros = 0;

  try {
    if (!aiEnabled) throw new AiUnavailableError("Mode démonstration.");
    const completion = await completeWithClaude({
      system: TRANSLATION_SYSTEM,
      user: `Langue source : ${input.sourceLanguage ?? "détection automatique"}\nLangue cible : ${target}\n\nTexte :\n"""${text}"""`,
      maxTokens: 3000,
      temperature: 0
    });
    result = translationSchema.parse(extractJson(completion.text));
    result.translatedText = result.translatedText.slice(0, 12_000);
    provider = "anthropic";
    outputTokens = completion.outputTokens;
    costMicros = completion.costMicros;
  } catch {
    result = mockTranslation({ text, targetLanguage: target });
    degraded = true;
  }

  await logAiRequest({
    userId: input.userId,
    type: "translate",
    model: provider === "anthropic" ? "claude" : "klerio-mock",
    provider,
    inputChars: text.length,
    outputTokens,
    costMicros,
    latencyMs: Date.now() - started,
    metadata: { target, degraded }
  }).catch(() => undefined);

  return { result, degraded, provider };
}

/* ------------------------------------------------------------------ */
/* Remplissage                                                         */
/* ------------------------------------------------------------------ */

export async function fillForm(input: {
  userId: string;
  text: string;
  formName?: string;
  mode: "assisted" | "autofill";
  allowCredits?: boolean;
}): Promise<{
  result: FillResult;
  quota: QuotaDecision | null;
  creditsLeft: number | null;
  degraded: boolean;
  officialLink: { slug: string; label: string; url: string } | null;
}> {
  const text = cleanInput(input.text).slice(0, 12_000);
  let quota: QuotaDecision | null = null;
  let creditsLeft: number | null = null;

  if (input.mode === "assisted") {
    const consumption = await consumeQuota({
      userId: input.userId,
      type: "assisted_fills",
      quantity: 1,
      allowCredits: input.allowCredits,
      note: "remplissage assisté"
    });
    quota = consumption.decision;
    creditsLeft = consumption.creditsLeft;
  } else {
    if (!input.allowCredits) {
      throw new AiInputError(
        "Le remplissage automatique utilise des crédits. Confirmez le débit dans le récapitulatif avant de continuer."
      );
    }
    const consumption = await consumeCredits({
      userId: input.userId,
      credits: AUTOFILL_CREDIT_COST,
      note: "remplissage automatique"
    });
    creditsLeft = consumption.creditsLeft;
  }

  const links = await linkCatalog();
  let result: FillResult;
  let degraded = false;
  try {
    if (!aiEnabled) throw new AiUnavailableError("Mode démonstration.");
    const completion = await completeWithClaude({
      system: FILL_SYSTEM,
      user: fillUserPrompt({ text, formName: input.formName, mode: input.mode, links }),
      maxTokens: 2000
    });
    result = fillSchema.parse(extractJson(completion.text));
  } catch {
    result = mockFill({ text, formName: input.formName, mode: input.mode });
    degraded = true;
  }

  const link = await resolveLink(result.officialLinkSlug, "autre");
  result.officialLinkSlug = link?.slug ?? null;
  result.disclaimer =
    "Klerio prépare les informations mais ne soumet jamais un formulaire à votre place. Vous relisez et validez vous-même sur le site officiel.";

  await logAiRequest({
    userId: input.userId,
    type: input.mode,
    model: aiEnabled && !degraded ? "claude" : "klerio-mock",
    provider: aiEnabled && !degraded ? "anthropic" : "mock",
    inputChars: text.length,
    quotaType: input.mode === "assisted" ? "assisted_fills" : undefined,
    quotaDebited: quota?.fromIncluded ?? 0,
    creditsDebited: input.mode === "autofill" ? AUTOFILL_CREDIT_COST : (quota?.creditsCost ?? 0),
    metadata: { degraded, mode: input.mode }
  }).catch(() => undefined);

  return {
    result,
    quota,
    creditsLeft,
    degraded,
    officialLink: link ? { slug: link.slug, label: link.label, url: link.url } : null
  };
}

/* ------------------------------------------------------------------ */
/* Classement automatique                                              */
/* ------------------------------------------------------------------ */

export async function classifyDocument(input: {
  userId: string;
  text: string;
  fileName?: string;
  allowCredits?: boolean;
}): Promise<{ detection: DetectionResult; quota: QuotaDecision }> {
  const detection = mockDetect(input.text, input.fileName ?? "");
  const consumption = await consumeQuota({
    userId: input.userId,
    type: "ai_sorting",
    quantity: 1,
    allowCredits: input.allowCredits,
    note: "classement automatique"
  });
  return { detection, quota: consumption.decision };
}
