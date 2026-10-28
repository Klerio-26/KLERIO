import "server-only";
import { db } from "@/lib/db";
import { getPlan, PLANS, type PlanDefinition, type PlanId, type QuotaDefinition, type QuotaType } from "./plans";
import { windowFor, formatReset } from "./periods";
import {
  computeStorageState,
  decideQuota,
  decideStorage,
  resolveQuotaOwner,
  type QuotaDecision,
  type QuotaAlternative,
  type StorageDecision,
  type StorageState
} from "./engine";

/* ------------------------------------------------------------------ */
/* Erreurs typées                                                      */
/* ------------------------------------------------------------------ */

export type { QuotaDecision, StorageDecision } from "./engine";

export class QuotaError extends Error {
  readonly status = 402;
  constructor(
    message: string,
    readonly decision: QuotaDecision
  ) {
    super(message);
    this.name = "QuotaError";
  }
}

export class StorageError extends Error {
  readonly status = 413;
  constructor(
    message: string,
    readonly decision: StorageDecision
  ) {
    super(message);
    this.name = "StorageError";
  }
}

/* ------------------------------------------------------------------ */
/* Contexte de facturation / portée des quotas                         */
/* ------------------------------------------------------------------ */

export interface AccountContext {
  userId: string;
  planId: PlanId;
  plan: PlanDefinition;
  groupId: string | null;
  familyPolicy: "shared" | "per_member";
  memberCount: number;
  role: "admin" | "member" | null;
  anchorDay: number;
  memberStorageLimitBytes: number | null;
  quotaOwnerType: "user" | "group";
  quotaOwnerId: string;
  storageOwnerType: "user" | "group";
  storageOwnerId: string;
  walletOwnerType: "user" | "group";
  walletOwnerId: string;
}

function dayOf(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", day: "numeric" }).format(date)
  );
}

export async function getAccountContext(userId: string): Promise<AccountContext> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      subscription: true,
      membership: { include: { group: true } }
    }
  });
  if (!user || user.deletedAt) throw new Error("Compte introuvable.");

  if (user.membership) {
    const group = user.membership.group;
    const admin = await db.user.findUnique({
      where: { id: group.adminId },
      include: { subscription: true }
    });
    const plan = PLANS.family;
    const members = await db.familyMember.count({ where: { groupId: group.id } });
    const anchor = admin?.subscription?.anchorDay ?? dayOf(admin?.createdAt ?? user.createdAt);
    return {
      userId,
      planId: "family",
      plan,
      groupId: group.id,
      familyPolicy: group.quotaPolicy === "per_member" ? "per_member" : "shared",
      memberCount: Math.max(1, members),
      role: user.membership.role === "admin" ? "admin" : "member",
      anchorDay: anchor,
      memberStorageLimitBytes: user.membership.storageLimitBytes ?? null,
      quotaOwnerType: "user",
      quotaOwnerId: userId,
      storageOwnerType: "group",
      storageOwnerId: group.id,
      walletOwnerType: "group",
      walletOwnerId: group.id
    };
  }

  const planId: PlanId = (user.subscription?.planId as PlanId) ?? "standard";
  const plan = getPlan(planId);
  const anchorDay = user.subscription?.anchorDay ?? dayOf(user.createdAt);
  return {
    userId,
    planId: plan.id,
    plan,
    groupId: null,
    familyPolicy: "shared",
    memberCount: 1,
    role: null,
    anchorDay,
    memberStorageLimitBytes: null,
    quotaOwnerType: "user",
    quotaOwnerId: userId,
    storageOwnerType: "user",
    storageOwnerId: userId,
    walletOwnerType: "user",
    walletOwnerId: userId
  };
}

function quotaLimitFor(context: AccountContext, definition: QuotaDefinition): number {
  if (context.planId === "family" && context.familyPolicy === "per_member" && definition.scope === "group") {
    return Math.max(0, Math.floor(definition.limit / context.memberCount));
  }
  return definition.limit;
}

function quotaOwnerFor(context: AccountContext, definition: QuotaDefinition): { ownerType: "user" | "group"; ownerId: string } {
  return resolveQuotaOwner({
    planId: context.planId,
    definition,
    userId: context.userId,
    groupId: context.groupId,
    familyPolicy: context.familyPolicy
  });
}

/* ------------------------------------------------------------------ */
/* Soldes                                                              */
/* ------------------------------------------------------------------ */

async function ensureWallet(ownerType: string, ownerId: string) {
  return db.creditWallet.upsert({
    where: { ownerType_ownerId: { ownerType, ownerId } },
    create: { ownerType, ownerId, balance: 0 },
    update: {}
  });
}

export async function getCreditBalance(userId: string): Promise<{ balance: number; ownerType: string; ownerId: string }> {
  const context = await getAccountContext(userId);
  const wallet = await ensureWallet(context.walletOwnerType, context.walletOwnerId);
  return { balance: wallet.balance, ownerType: wallet.ownerType, ownerId: wallet.ownerId };
}

export async function addCredits(input: {
  ownerType: string;
  ownerId: string;
  credits: number;
  reason: string;
  refId?: string;
  metadata?: Record<string, unknown>;
}): Promise<number> {
  if (input.credits <= 0) throw new Error("Le nombre de crédits doit être positif.");
  return db.$transaction(async (tx) => {
    const wallet = await tx.creditWallet.upsert({
      where: { ownerType_ownerId: { ownerType: input.ownerType, ownerId: input.ownerId } },
      create: { ownerType: input.ownerType, ownerId: input.ownerId, balance: input.credits },
      update: { balance: { increment: input.credits } }
    });
    await tx.creditTransaction.create({
      data: {
        walletId: wallet.id,
        delta: input.credits,
        reason: input.reason,
        refId: input.refId,
        metadata: JSON.stringify(input.metadata ?? {})
      }
    });
    return wallet.balance;
  });
}

/* ------------------------------------------------------------------ */
/* Aperçu                                                              */
/* ------------------------------------------------------------------ */

export interface QuotaLine {
  definition: QuotaDefinition;
  used: number;
  limit: number;
  remaining: number;
  periodKey: string;
  resetAt: Date;
  ownerType: "user" | "group";
  ownerId: string;
  scopeLabel: string;
}

export interface StorageSnapshot {
  ownerType: "user" | "group";
  ownerId: string;
  usedBytes: number;
  limitBytes: number;
  memberUsedBytes: number | null;
  memberLimitBytes: number | null;
  ratio: number;
  state: StorageState;
  graceEndsAt: Date | null;
}

export interface AccountSnapshot {
  context: AccountContext;
  lines: QuotaLine[];
  storage: StorageSnapshot;
  credits: number;
  resetAnchor: string;
}

async function readLine(
  context: AccountContext,
  definition: QuotaDefinition,
  now: Date
): Promise<QuotaLine> {
  const owner = quotaOwnerFor(context, definition);
  const limit = quotaLimitFor(context, definition);
  const window = windowFor(definition.periodicity, now, context.anchorDay);
  const counter = await db.quotaCounter.findUnique({
    where: {
      ownerType_ownerId_type_periodKey: {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        type: definition.type,
        periodKey: window.key
      }
    }
  });
  const used = counter?.used ?? 0;
  return {
    definition,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    periodKey: window.key,
    resetAt: window.end,
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    scopeLabel:
      owner.ownerType === "group"
        ? "Pool famille"
        : context.planId === "family"
          ? "Individuel"
          : "Personnel"
  };
}

export async function getStorageSnapshot(context: AccountContext): Promise<StorageSnapshot> {
  const limitBytes = context.plan.storageBytes;
  const account = await db.storageAccount.upsert({
    where: { ownerType_ownerId: { ownerType: context.storageOwnerType, ownerId: context.storageOwnerId } },
    create: {
      ownerType: context.storageOwnerType,
      ownerId: context.storageOwnerId,
      usedBytes: 0,
      limitBytes,
      state: "normal"
    },
    update: { limitBytes }
  });

  let memberUsedBytes: number | null = null;
  if (context.groupId) {
    const docs = await db.document.aggregate({
      where: { ownerId: context.userId, status: { in: ["active", "trash"] } },
      _sum: { sizeBytes: true }
    });
    memberUsedBytes = docs._sum.sizeBytes ?? 0;
  }

  const state: StorageState =
    account.state === "read_only" ? "read_only" : computeStorageState(account.usedBytes, account.limitBytes);

  return {
    ownerType: context.storageOwnerType,
    ownerId: context.storageOwnerId,
    usedBytes: account.usedBytes,
    limitBytes: account.limitBytes,
    memberUsedBytes,
    memberLimitBytes: context.memberStorageLimitBytes,
    ratio: account.limitBytes > 0 ? Math.min(1, account.usedBytes / account.limitBytes) : 1,
    state,
    graceEndsAt: account.graceEndsAt
  };
}

export async function getAccountSnapshot(userId: string, now = new Date()): Promise<AccountSnapshot> {
  const context = await getAccountContext(userId);
  const definitions = Object.values(context.plan.quotas);
  const lines: QuotaLine[] = [];
  for (const def of definitions) {
    lines.push(await readLine(context, def, now));
  }
  const storage = await getStorageSnapshot(context);
  const wallet = await ensureWallet(context.walletOwnerType, context.walletOwnerId);
  return {
    context,
    lines,
    storage,
    credits: wallet.balance,
    resetAnchor: `Le ${context.anchorDay} de chaque mois, à 00h00 (Paris)`
  };
}

/* ------------------------------------------------------------------ */
/* Décision et consommation                                            */
/* ------------------------------------------------------------------ */

export async function previewQuota(input: {
  userId: string;
  type: QuotaType;
  quantity?: number;
  allowCredits?: boolean;
  now?: Date;
}): Promise<{ decision: QuotaDecision; line: QuotaLine; credits: number }> {
  const now = input.now ?? new Date();
  const context = await getAccountContext(input.userId);
  const definition = context.plan.quotas[input.type];
  if (!definition) throw new Error(`Quota inconnu : ${input.type}`);
  const line = await readLine(context, definition, now);
  const wallet = await ensureWallet(context.walletOwnerType, context.walletOwnerId);
  const decision = decideQuota({
    plan: context.plan,
    definition,
    usage: {
      used: line.used,
      limit: line.limit,
      periodKey: line.periodKey,
      resetAt: line.resetAt
    },
    creditBalance: wallet.balance,
    allowCredits: input.allowCredits ?? false,
    quantity: input.quantity ?? 1,
    now
  });
  return { decision, line, credits: wallet.balance };
}

export interface ConsumptionResult {
  decision: QuotaDecision;
  usageId: string;
  creditsLeft: number;
}

/**
 * Débite le quota inclus, puis éventuellement les crédits (si allowCredits).
 * Tout est atomique : en cas d'échec, rien n'est débité.
 */
export async function consumeQuota(input: {
  userId: string;
  type: QuotaType;
  quantity?: number;
  allowCredits?: boolean;
  note?: string;
  now?: Date;
}): Promise<ConsumptionResult> {
  const now = input.now ?? new Date();
  const quantity = input.quantity ?? 1;
  const context = await getAccountContext(input.userId);
  const definition = context.plan.quotas[input.type];
  if (!definition) throw new Error(`Quota inconnu : ${input.type}`);
  const owner = quotaOwnerFor(context, definition);
  const limit = quotaLimitFor(context, definition);
  const window = windowFor(definition.periodicity, now, context.anchorDay);

  return db.$transaction(async (tx) => {
    const counter = await tx.quotaCounter.upsert({
      where: {
        ownerType_ownerId_type_periodKey: {
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          type: definition.type,
          periodKey: window.key
        }
      },
      create: {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        type: definition.type,
        periodKey: window.key,
        used: 0,
        limit,
        periodStart: window.start,
        periodEnd: window.end
      },
      update: { limit, periodStart: window.start, periodEnd: window.end }
    });

    const wallet = await tx.creditWallet.upsert({
      where: { ownerType_ownerId: { ownerType: context.walletOwnerType, ownerId: context.walletOwnerId } },
      create: { ownerType: context.walletOwnerType, ownerId: context.walletOwnerId, balance: 0 },
      update: {}
    });

    const decision = decideQuota({
      plan: context.plan,
      definition,
      usage: {
        used: counter.used,
        limit,
        periodKey: window.key,
        resetAt: window.end
      },
      creditBalance: wallet.balance,
      allowCredits: input.allowCredits ?? false,
      quantity,
      now
    });

    if (!decision.allowed) throw new QuotaError(decision.message, decision);

    if (decision.fromIncluded > 0) {
      await tx.quotaCounter.update({
        where: { id: counter.id },
        data: { used: { increment: decision.fromIncluded } }
      });
    }

    let creditsLeft = wallet.balance;
    if (decision.fromCredits > 0) {
      const updated = await tx.creditWallet.updateMany({
        where: { id: wallet.id, balance: { gte: decision.creditsCost } },
        data: { balance: { decrement: decision.creditsCost } }
      });
      if (updated.count === 0) {
        throw new QuotaError("Votre solde de crédits a changé. Vérifiez le montant avant de confirmer.", decision);
      }
      creditsLeft = wallet.balance - decision.creditsCost;
      await tx.creditTransaction.create({
        data: {
          walletId: wallet.id,
          delta: -decision.creditsCost,
          reason: `quota:${definition.type}`,
          metadata: JSON.stringify({ periodKey: window.key, quantity })
        }
      });
    }

    const usage = await tx.usageRecord.create({
      data: {
        userId: input.userId,
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        type: definition.type,
        quantity,
        fromIncluded: decision.fromIncluded,
        creditsCost: decision.creditsCost,
        periodKey: window.key,
        note: input.note
      }
    });

    return { decision, usageId: usage.id, creditsLeft };
  });
}

/** Débit direct de crédits (remplissage automatique, hors quota inclus). */
export async function consumeCredits(input: {
  userId: string;
  credits: number;
  note: string;
}): Promise<{ creditsLeft: number; usageId: string }> {
  if (input.credits <= 0) throw new Error("Montant de crédits invalide.");
  const context = await getAccountContext(input.userId);
  return db.$transaction(async (tx) => {
    const wallet = await tx.creditWallet.findUnique({
      where: { ownerType_ownerId: { ownerType: context.walletOwnerType, ownerId: context.walletOwnerId } }
    });
    if (!wallet || wallet.balance < input.credits) {
      throw new Error(
        `Crédits insuffisants : ${input.credits} nécessaires, ${wallet?.balance ?? 0} disponibles. Achetez un complément ou attendez le renouvellement.`
      );
    }
    const updated = await tx.creditWallet.updateMany({
      where: { id: wallet.id, balance: { gte: input.credits } },
      data: { balance: { decrement: input.credits } }
    });
    if (updated.count === 0) throw new Error("Le solde a changé. Réessayez.");
    await tx.creditTransaction.create({
      data: {
        walletId: wallet.id,
        delta: -input.credits,
        reason: `action:${input.note}`
      }
    });
    const usage = await tx.usageRecord.create({
      data: {
        userId: input.userId,
        ownerType: context.walletOwnerType,
        ownerId: context.walletOwnerId,
        type: "autofill",
        quantity: 1,
        fromIncluded: 0,
        creditsCost: input.credits,
        periodKey: "credit",
        note: input.note
      }
    });
    return { creditsLeft: wallet.balance - input.credits, usageId: usage.id };
  });
}

/** Rembourse un débit (ex. appel IA en échec). Ne rembourse jamais deux fois. */
export async function refundUsage(usageId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const usage = await tx.usageRecord.findUnique({ where: { id: usageId } });
    if (!usage || usage.refundedAt) return;
    if (usage.fromIncluded > 0) {
      await tx.quotaCounter.updateMany({
        where: {
          ownerType: usage.ownerType,
          ownerId: usage.ownerId,
          type: usage.type,
          periodKey: usage.periodKey
        },
        data: { used: { decrement: usage.fromIncluded } }
      });
    }
    if (usage.creditsCost > 0) {
      const wallet = await tx.creditWallet.findFirst({
        where: { ownerType: usage.ownerType, ownerId: usage.ownerId }
      });
      if (wallet) {
        await tx.creditWallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: usage.creditsCost } }
        });
        await tx.creditTransaction.create({
          data: {
            walletId: wallet.id,
            delta: usage.creditsCost,
            reason: "remboursement",
            refId: usage.id
          }
        });
      }
    }
    await tx.usageRecord.update({ where: { id: usage.id }, data: { refundedAt: new Date() } });
  });
}

/* ------------------------------------------------------------------ */
/* Stockage                                                            */
/* ------------------------------------------------------------------ */

export async function previewStorage(userId: string, incomingBytes: number): Promise<StorageDecision> {
  const context = await getAccountContext(userId);
  const snapshot = await getStorageSnapshot(context);
  return decideStorage({
    usedBytes: snapshot.usedBytes,
    limitBytes: snapshot.limitBytes,
    incomingBytes,
    readOnly: snapshot.state === "read_only",
    graceEndsAt: snapshot.graceEndsAt,
    memberUsedBytes: snapshot.memberUsedBytes ?? undefined,
    memberLimitBytes: snapshot.memberLimitBytes,
    planId: context.planId
  });
}

export async function assertStorage(userId: string, incomingBytes: number): Promise<void> {
  const decision = await previewStorage(userId, incomingBytes);
  if (!decision.allowed) throw new StorageError(decision.message, decision);
}

export async function applyStoragePlanChange(userId: string, newPlanId: PlanId, now = new Date()): Promise<void> {
  const context = await getAccountContext(userId);
  const limitBytes = getPlan(newPlanId).storageBytes;
  const ownerType = context.storageOwnerType;
  const ownerId = context.storageOwnerId;
  const account = await db.storageAccount.upsert({
    where: { ownerType_ownerId: { ownerType, ownerId } },
    create: { ownerType, ownerId, usedBytes: 0, limitBytes, state: "normal" },
    update: { limitBytes }
  });
  if (account.usedBytes > limitBytes) {
    await db.storageAccount.update({
      where: { id: account.id },
      data: {
        state: "read_only",
        graceEndsAt: new Date(now.getTime() + 60 * 86400000)
      }
    });
  } else {
    await db.storageAccount.update({
      where: { id: account.id },
      data: { state: computeStorageState(account.usedBytes, limitBytes), graceEndsAt: null }
    });
  }
}

/* ------------------------------------------------------------------ */
/* Journal IA                                                          */
/* ------------------------------------------------------------------ */

export async function logAiRequest(input: {
  userId: string;
  type: string;
  model: string;
  provider: string;
  inputChars: number;
  outputTokens?: number;
  costMicros?: number;
  quotaType?: string;
  quotaDebited?: number;
  creditsDebited?: number;
  status?: string;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.aiRequest.create({
    data: {
      userId: input.userId,
      type: input.type,
      model: input.model,
      provider: input.provider,
      inputChars: input.inputChars,
      outputTokens: input.outputTokens ?? 0,
      costMicros: input.costMicros ?? 0,
      quotaType: input.quotaType,
      quotaDebited: input.quotaDebited ?? 0,
      creditsDebited: input.creditsDebited ?? 0,
      status: input.status ?? "ok",
      latencyMs: input.latencyMs ?? 0,
      metadata: JSON.stringify(input.metadata ?? {})
    }
  });
}

export function alternativeLabels(alternatives: QuotaAlternative[]): string[] {
  return alternatives.map((a) => a.label);
}

export function resetLabel(date: Date, now = new Date()): string {
  return `Renouvellement ${formatReset(date, now)}`;
}
