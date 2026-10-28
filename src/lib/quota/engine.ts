/**
 * Moteur de quotas — fonctions pures, sans base de données ni framework.
 * Le service (`service.ts`) charge l'état, appelle ce moteur, puis persiste.
 * Toute décision renvoyée contient un message lisible en français.
 */

import {
  CREDIT_VALUE_CENTS,
  type PlanDefinition,
  type PlanId,
  type QuotaDefinition,
  type QuotaType,
  formatBytes
} from "./plans";
import { LIFETIME_END, formatReset } from "./periods";

export type StorageState = "normal" | "warning" | "critical" | "full" | "read_only";

export type QuotaBlockReason =
  | "ok"
  | "empty_request"
  | "quota_excluded"
  | "included_exhausted"
  | "credits_required"
  | "credits_insufficient";

export interface QuotaUsage {
  used: number;
  limit: number;
  periodKey: string;
  resetAt: Date;
}

export interface QuotaDecision {
  allowed: boolean;
  type: QuotaType;
  requested: number;
  includedUsed: number;
  includedLimit: number;
  includedRemaining: number;
  includedRemainingAfter: number;
  fromIncluded: number;
  fromCredits: number;
  creditsCost: number;
  creditBalance: number;
  requiresExplicitConsent: boolean;
  reason: QuotaBlockReason;
  message: string;
  resetAt: Date;
  alternatives: QuotaAlternative[];
}

export interface QuotaAlternative {
  code: "wait" | "credits" | "buy_credits" | "upgrade" | "free_space" | "compress";
  label: string;
  detail: string;
}

export interface QuotaDecisionInput {
  plan: PlanDefinition;
  definition: QuotaDefinition;
  usage: QuotaUsage;
  creditBalance: number;
  allowCredits?: boolean;
  quantity?: number;
  now?: Date;
}

function plural(unit: string, n: number): string {
  if (n <= 1) return unit;
  return /s$/.test(unit) ? unit : `${unit}s`;
}

export function decideQuota(input: QuotaDecisionInput): QuotaDecision {
  const {
    plan,
    definition,
    usage,
    creditBalance,
    allowCredits = false,
    quantity = 1,
    now = new Date()
  } = input;

  const requested = Math.max(0, Math.floor(quantity));
  const limit = Math.max(0, usage.limit);
  const used = Math.max(0, usage.used);
  const includedRemaining = Math.max(0, limit - used);
  const resetAt = usage.resetAt ?? LIFETIME_END;
  const unit = definition.unit;
  const creditsPurchasable = plan.creditsEnabled && definition.creditUnitCost !== null;

  const base: QuotaDecision = {
    allowed: false,
    type: definition.type,
    requested,
    includedUsed: used,
    includedLimit: limit,
    includedRemaining,
    includedRemainingAfter: includedRemaining,
    fromIncluded: 0,
    fromCredits: 0,
    creditsCost: 0,
    creditBalance,
    requiresExplicitConsent: false,
    reason: "ok",
    message: "",
    resetAt,
    alternatives: []
  };

  if (requested === 0) {
    return { ...base, allowed: true, reason: "empty_request", message: "Aucune page à compter." };
  }

  if (limit === 0 && !creditsPurchasable) {
    return {
      ...base,
      reason: "quota_excluded",
      message:
        definition.type === "assisted_fills" || definition.type === "ai_sorting"
          ? definition.type === "assisted_fills"
            ? "Le remplissage assisté n'est pas inclus dans votre forfait. Passez à Pro pour l'utiliser."
            : "Le classement automatique est réservé aux forfaits Pro et Pro Famille."
          : "Cette fonctionnalité n'est pas incluse dans votre forfait.",
      alternatives: upgradeAlternatives(plan)
    };
  }

  const fromIncluded = Math.min(requested, includedRemaining);
  const missing = requested - fromIncluded;
  const unitCost = definition.creditUnitCost ?? 0;
  const creditsCost = missing * unitCost;

  if (missing === 0) {
    const after = includedRemaining - fromIncluded;
    return {
      ...base,
      allowed: true,
      fromIncluded,
      includedRemainingAfter: after,
      message:
        limit >= 1_000_000 || definition.periodicity === "lifetime"
          ? `Cette action utilise ${requested} ${plural(unit, requested)}. Il vous restera ${after} ${plural(unit, after)} au total.`
          : `Cette action utilise ${requested} ${plural(unit, requested)}. Il vous restera ${after} ${plural(unit, after)} ${resetLabel(definition, resetAt, now)}.`
    };
  }

  if (creditsPurchasable && allowCredits && creditBalance >= creditsCost) {
    return {
      ...base,
      allowed: true,
      fromIncluded,
      fromCredits: missing,
      creditsCost,
      requiresExplicitConsent: true,
      message: `Votre quota inclus est insuffisant. ${fromIncluded > 0 ? `${fromIncluded} ${plural(unit, fromIncluded)} seront prises sur le quota inclus, ` : ""}${missing} ${plural(unit, missing)} seront débitées de vos crédits : ${creditsCost} crédits (solde actuel : ${creditBalance}).`
    };
  }

  const reason: QuotaBlockReason =
    limit === 0
      ? "quota_excluded"
      : !creditsPurchasable
        ? "included_exhausted"
        : !allowCredits
          ? "credits_required"
          : "credits_insufficient";

  const alternatives: QuotaAlternative[] = [];
  if (definition.periodicity !== "lifetime") {
    alternatives.push({
      code: "wait",
      label: "Attendre le renouvellement",
      detail: `Votre quota repart ${formatReset(resetAt, now)}. Rien ne vous sera prélevé.`
    });
  }
  if (creditsPurchasable) {
    alternatives.push({
      code: creditBalance >= creditsCost ? "credits" : "buy_credits",
      label: creditBalance >= creditsCost ? `Utiliser ${creditsCost} crédits` : "Acheter des crédits",
      detail:
        creditBalance >= creditsCost
          ? `Solde : ${creditBalance} crédits. Aucun abonnement ne sera modifié.`
          : `Il manque ${Math.max(0, creditsCost - creditBalance)} crédits. Achat unique, sans reconduction.`
    });
  }
  alternatives.push(...upgradeAlternatives(plan));

  let message: string;
  if (limit === 0) {
    message = "Votre forfait ne comprend pas cette action.";
  } else if (includedRemaining === 0) {
    message =
      definition.periodicity === "lifetime"
        ? `Vos ${limit} ${plural(unit, limit)} incluses sont utilisées. Ce quota ne se réinitialise jamais.`
        : `Quota épuisé : ${used}/${limit} ${plural(unit, limit)}. Il repart ${formatReset(resetAt, now)}.`;
  } else {
    message = `Il vous reste ${includedRemaining} ${plural(unit, includedRemaining)} incluses, mais cette action en demande ${requested}.`;
  }
  if (creditsPurchasable && allowCredits) {
    message += ` Il faudrait ${creditsCost} crédits, votre solde est de ${creditBalance}.`;
  }

  return {
    ...base,
    reason,
    fromIncluded: 0,
    creditsCost,
    message,
    alternatives,
    requiresExplicitConsent: false
  };
}

function resetLabel(definition: QuotaDefinition, resetAt: Date, now: Date): string {
  if (definition.periodicity === "lifetime") return "au total";
  return `avant le renouvellement (${formatReset(resetAt, now)})`;
}

function upgradeAlternatives(plan: PlanDefinition): QuotaAlternative[] {
  if (plan.id === "family") return [];
  const next: PlanId = plan.id === "standard" ? "pro" : "family";
  return [
    {
      code: "upgrade",
      label: next === "pro" ? "Passer à Pro" : "Passer à Pro Famille",
      detail:
        next === "pro"
          ? "7,99 €/mois : 100 pages de scan, 300 explications, classement IA."
          : "12,99 €/mois : jusqu'à 5 personnes, 50 Go partagés."
    }
  ];
}

/* ------------------------------------------------------------------ */
/* Stockage                                                            */
/* ------------------------------------------------------------------ */

export interface StorageInput {
  usedBytes: number;
  limitBytes: number;
  incomingBytes: number;
  readOnly?: boolean;
  graceEndsAt?: Date | null;
  memberUsedBytes?: number;
  memberLimitBytes?: number | null;
  now?: Date;
  planId?: PlanId;
}

export interface StorageDecision {
  allowed: boolean;
  state: StorageState;
  usedBytes: number;
  limitBytes: number;
  incomingBytes: number;
  projectedBytes: number;
  projectedRatio: number;
  reason: "ok" | "full" | "read_only" | "member_limit";
  message: string;
  alternatives: QuotaAlternative[];
  graceEndsAt: Date | null;
}

export function computeStorageState(usedBytes: number, limitBytes: number): StorageState {
  if (limitBytes <= 0) return "full";
  const ratio = usedBytes / limitBytes;
  if (ratio >= 1) return "full";
  if (ratio >= 0.9) return "critical";
  if (ratio >= 0.8) return "warning";
  return "normal";
}

export function decideStorage(input: StorageInput): StorageDecision {
  const {
    usedBytes,
    limitBytes,
    incomingBytes,
    readOnly = false,
    graceEndsAt = null,
    memberUsedBytes,
    memberLimitBytes = null,
    now = new Date(),
    planId
  } = input;

  const projectedBytes = usedBytes + Math.max(0, incomingBytes);
  const projectedRatio = limitBytes > 0 ? projectedBytes / limitBytes : 1;
  const baseState = computeStorageState(usedBytes, limitBytes);
  const alternatives: QuotaAlternative[] = [
    { code: "free_space", label: "Supprimer des documents", detail: "La corbeille compte jusqu'à sa vidange définitive." },
    { code: "compress", label: "Compresser les PDF", detail: "Sans perte visible, pour libérer de la place." }
  ];
  if (planId && planId !== "family") {
    alternatives.push({
      code: "upgrade",
      label: planId === "standard" ? "Passer à Pro (15 Go)" : "Passer à Pro Famille (50 Go)",
      detail: "Vos documents sont conservés, sans suppression automatique."
    });
  }

  if (readOnly) {
    return {
      allowed: false,
      state: "read_only",
      usedBytes,
      limitBytes,
      incomingBytes,
      projectedBytes,
      projectedRatio,
      reason: "read_only",
      message: graceEndsAt
        ? `Votre coffre est en lecture seule après un changement de forfait. Vos documents restent consultables et exportables jusqu'au ${graceEndsAt.toLocaleDateString("fr-FR")}. Aucun document n'a été supprimé.`
        : "Votre coffre est en lecture seule. Vos documents restent consultables et exportables. Aucun document n'a été supprimé.",
      alternatives: alternatives.filter((a) => a.code !== "compress"),
      graceEndsAt
    };
  }

  if (memberLimitBytes !== null && memberLimitBytes !== undefined && memberUsedBytes !== undefined) {
    if (memberUsedBytes + incomingBytes > memberLimitBytes) {
      return {
        allowed: false,
        state: baseState,
        usedBytes,
        limitBytes,
        incomingBytes,
        projectedBytes,
        projectedRatio,
        reason: "member_limit",
        message: `La limite personnelle fixée par l'administrateur est atteinte (${formatBytes(memberLimitBytes)}). Demandez-lui de l'augmenter, ou supprimez des documents.`,
        alternatives: alternatives.filter((a) => a.code === "free_space"),
        graceEndsAt: null
      };
    }
  }

  if (projectedBytes > limitBytes) {
    return {
      allowed: false,
      state: baseState === "full" ? "full" : baseState,
      usedBytes,
      limitBytes,
      incomingBytes,
      projectedBytes,
      projectedRatio,
      reason: "full",
      message: `Votre coffre est plein : ${formatBytes(usedBytes)} utilisés sur ${formatBytes(limitBytes)}. Vos documents restent consultables et exportables. Pour enregistrer ce document, libérez de la place ou changez de forfait.`,
      alternatives,
      graceEndsAt: null
    };
  }

  return {
    allowed: true,
    state: computeStorageState(projectedBytes, limitBytes),
    usedBytes,
    limitBytes,
    incomingBytes,
    projectedBytes,
    projectedRatio,
    reason: "ok",
    message:
      projectedRatio >= 0.9
        ? `Attention : votre coffre sera rempli à ${Math.round(projectedRatio * 100)} %.`
        : projectedRatio >= 0.8
          ? `Votre coffre sera rempli à ${Math.round(projectedRatio * 100)} %.`
          : "Espace suffisant.",
    alternatives: projectedRatio >= 0.8 ? alternatives : [],
    graceEndsAt: null
  };
}

/** Après downgrade : jamais de suppression, lecture seule + 60 jours de grâce. */
export function applyDowngrade(input: {
  usedBytes: number;
  newLimitBytes: number;
  now?: Date;
  graceDays?: number;
}): { readOnly: boolean; graceEndsAt: Date | null; state: StorageState } {
  const { usedBytes, newLimitBytes, now = new Date(), graceDays = 60 } = input;
  if (usedBytes > newLimitBytes) {
    return {
      readOnly: true,
      graceEndsAt: new Date(now.getTime() + graceDays * 86400000),
      state: "read_only"
    };
  }
  return {
    readOnly: false,
    graceEndsAt: null,
    state: computeStorageState(usedBytes, newLimitBytes)
  };
}

/** Convertit un montant en crédits (1 crédit = 0,10 €). */
export function creditsForAmount(cents: number): number {
  return Math.floor(cents / CREDIT_VALUE_CENTS);
}

export function amountForCredits(credits: number): number {
  return credits * CREDIT_VALUE_CENTS;
}

/** Résolution de la portée d'un quota (famille mutualisée ou individuelle). */
export function resolveQuotaOwner(input: {
  planId: PlanId;
  definition: QuotaDefinition;
  userId: string;
  groupId: string | null;
  familyPolicy: "shared" | "per_member";
}): { ownerType: "user" | "group"; ownerId: string } {
  const { planId, definition, userId, groupId, familyPolicy } = input;
  if (planId === "family" && groupId && definition.scope === "group" && familyPolicy === "shared") {
    return { ownerType: "group", ownerId: groupId };
  }
  return { ownerType: "user", ownerId: userId };
}
