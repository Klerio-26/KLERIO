import "server-only";
import { db } from "@/lib/db";
import { allowSimulation } from "@/lib/env";
import { getPlan, formatPrice, formatBytes, type PlanId, PLANS } from "@/lib/quota/plans";
import { addCredits, applyStoragePlanChange, getAccountContext, getStorageSnapshot } from "@/lib/quota/service";
import { applyDowngrade } from "@/lib/quota/engine";
import { audit } from "@/lib/audit";
import { deleteFamilyGroup } from "@/lib/family";

export interface PlanChangeSummary {
  currentPlanId: PlanId;
  targetPlanId: PlanId;
  interval: "monthly" | "yearly";
  direction: "upgrade" | "downgrade" | "same";
  priceLabel: string;
  prorataLabel: string;
  storage: {
    usedBytes: number;
    currentLimitBytes: number;
    targetLimitBytes: number;
    becomesReadOnly: boolean;
    graceEndsAt: Date | null;
  };
  gained: string[];
  lost: string[];
  quotaChanges: Array<{ label: string; from: string; to: string }>;
  warnings: string[];
}

function quotaSummary(planId: PlanId) {
  const plan = getPlan(planId);
  return plan.quotas;
}

export async function getPlanChangeSummary(
  userId: string,
  targetPlanId: PlanId,
  interval: "monthly" | "yearly" = "monthly"
): Promise<PlanChangeSummary> {
  const context = await getAccountContext(userId);
  const storage = await getStorageSnapshot(context);
  const current = getPlan(context.planId);
  const target = getPlan(targetPlanId);
  const direction =
    target.priceMonthlyCents === current.priceMonthlyCents
      ? "same"
      : target.priceMonthlyCents > current.priceMonthlyCents
        ? "upgrade"
        : "downgrade";

  const quotaChanges: PlanChangeSummary["quotaChanges"] = [];
  const types = new Set([...Object.keys(current.quotas), ...Object.keys(target.quotas)]);
  for (const type of types) {
    const a = current.quotas[type as keyof typeof current.quotas];
    const b = target.quotas[type as keyof typeof target.quotas];
    if (!a || !b) continue;
    if (a.limit !== b.limit || a.periodicity !== b.periodicity) {
      const suffix = (q: typeof a) =>
        q.limit === 0 ? "non inclus" : `${q.limit} ${q.unit}${q.limit > 1 ? "s" : ""} / ${q.periodicity === "weekly" ? "semaine" : q.periodicity === "monthly" ? "mois" : "à vie"}`;
      quotaChanges.push({ label: a.shortLabel, from: suffix(a), to: suffix(b) });
    }
  }

  const downgrade = applyDowngrade({
    usedBytes: storage.usedBytes,
    newLimitBytes: target.storageBytes
  });

  const gained = target.features.filter((f) => !current.features.includes(f));
  const lost = current.features.filter((f) => !target.features.includes(f));
  const warnings: string[] = [];
  if (direction === "downgrade" && storage.usedBytes > target.storageBytes) {
    warnings.push(
      `Vos ${formatBytes(storage.usedBytes)} dépassent la nouvelle limite de ${formatBytes(target.storageBytes)}. Aucun document ne sera supprimé : le coffre passera en lecture seule avec 60 jours de grâce pour exporter.`
    );
  }
  if (direction === "downgrade") {
    warnings.push("Les quotas non utilisés ne sont pas remboursés. Les crédits restent disponibles.");
  }
  if (targetPlanId === "family" && context.planId !== "family") {
    warnings.push("Vous deviendrez administrateur du groupe famille. Les membres invités auront chacun un espace privé.");
  }
  if (targetPlanId !== "family" && context.planId === "family") {
    warnings.push("En quittant Pro Famille, les autres membres perdent l'accès. Ils pourront exporter leurs documents avant la fin.");
  }

  const price = interval === "yearly" ? target.priceYearlyCents : target.priceMonthlyCents;
  return {
    currentPlanId: context.planId,
    targetPlanId,
    interval,
    direction,
    priceLabel: `${formatPrice(price)} ${interval === "yearly" ? "TTC / an" : "TTC / mois"}`,
    prorataLabel:
      direction === "upgrade"
        ? "Stripe calcule le prorata au moment du paiement. Le montant exact est affiché avant validation."
        : "Le nouveau tarif s'appliquera à la prochaine échéance. Aucun remboursement automatique du mois en cours.",
    storage: {
      usedBytes: storage.usedBytes,
      currentLimitBytes: storage.limitBytes,
      targetLimitBytes: target.storageBytes,
      becomesReadOnly: downgrade.readOnly,
      graceEndsAt: downgrade.graceEndsAt
    },
    gained,
    lost,
    quotaChanges,
    warnings
  };
}

export async function simulatePlanChange(input: {
  userId: string;
  planId: PlanId;
  interval?: "monthly" | "yearly";
  now?: Date;
}): Promise<void> {
  if (!allowSimulation) throw new Error("La simulation est désactivée. Utilisez Stripe.");
  const now = input.now ?? new Date();
  const previous = await db.subscription.findUnique({ where: { userId: input.userId } });
  if (previous?.planId === "family" && input.planId !== "family") {
    const membership = await db.familyMember.findUnique({ where: { userId: input.userId } });
    if (membership?.role === "admin") {
      await deleteFamilyGroup(input.userId);
    }
  }
  const anchorDay = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", day: "numeric" }).format(now)
  );
  await db.subscription.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      planId: input.planId,
      billingInterval: input.interval ?? "monthly",
      status: "active",
      anchorDay,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 86400000)
    },
    update: {
      planId: input.planId,
      billingInterval: input.interval ?? "monthly",
      status: "active",
      anchorDay,
      cancelAtPeriodEnd: false
    }
  });
  await applyStoragePlanChange(input.userId, input.planId, now);
  await audit({
    actorId: input.userId,
    action: "billing.plan.simulated",
    targetType: "subscription",
    targetId: input.userId,
    metadata: { planId: input.planId }
  });
}

export async function simulateCreditsPurchase(userId: string, amountCents: number): Promise<number> {
  if (!allowSimulation) throw new Error("La simulation est désactivée. Utilisez Stripe.");
  if (amountCents < 200 || amountCents > 2000) throw new Error("Montant autorisé : entre 2 € et 20 €.");
  const credits = Math.floor(amountCents / 10);
  const context = await getAccountContext(userId);
  const balance = await addCredits({
    ownerType: context.walletOwnerType,
    ownerId: context.walletOwnerId,
    credits,
    reason: "achat_simule",
    metadata: { amountCents }
  });
  await audit({
    actorId: userId,
    action: "credits.purchase.simulated",
    targetType: "wallet",
    targetId: context.walletOwnerId,
    metadata: { amountCents, credits }
  });
  return balance;
}

export async function simulateCancel(userId: string): Promise<void> {
  if (!allowSimulation) throw new Error("La simulation est désactivée.");
  await db.subscription.update({
    where: { userId },
    data: { cancelAtPeriodEnd: true, status: "active" }
  });
  await audit({ actorId: userId, action: "billing.cancel.simulated", targetType: "subscription", targetId: userId });
}

export async function getBillingOverview(userId: string) {
  const context = await getAccountContext(userId);
  const [subscription, invoices, wallet] = await Promise.all([
    db.subscription.findUnique({ where: { userId } }),
    db.invoice.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 24 }),
    db.creditWallet.findUnique({
      where: { ownerType_ownerId: { ownerType: context.walletOwnerType, ownerId: context.walletOwnerId } }
    })
  ]);
  const transactions = wallet
    ? await db.creditTransaction.findMany({ where: { walletId: wallet.id }, orderBy: { createdAt: "desc" }, take: 20 })
    : [];
  return {
    plan: getPlan(context.planId),
    subscription,
    invoices,
    credits: wallet?.balance ?? 0,
    transactions,
    plans: [PLANS.standard, PLANS.pro, PLANS.family]
  };
}
