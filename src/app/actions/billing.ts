"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { allowSimulation, env } from "@/lib/env";
import { getStripe, createBillingPortal } from "@/lib/billing/stripe";
import { simulateCancel, simulateCreditsPurchase, simulatePlanChange } from "@/lib/billing/service";
import { addCredits, getAccountContext } from "@/lib/quota/service";
import { audit } from "@/lib/audit";
import type { PlanId } from "@/lib/quota/plans";

export interface BillingState {
  ok: boolean;
  error?: string;
  message?: string;
}

function parsePlan(value: string): PlanId {
  if (value === "pro" || value === "family" || value === "standard") return value;
  throw new Error("Forfait inconnu.");
}

export async function startPlanChangeAction(_prev: BillingState, formData: FormData): Promise<BillingState> {
  const { user } = await requireUser();
  const planId = parsePlan(String(formData.get("planId") ?? ""));
  const interval = String(formData.get("interval") ?? "monthly") === "yearly" ? "yearly" : "monthly";
  const confirmed = formData.get("confirm") === "on";
  if (!confirmed) {
    return { ok: false, error: "Cochez la case de confirmation après avoir lu les conséquences du changement." };
  }

  if (!getStripe()) {
    if (!allowSimulation) {
      return { ok: false, error: "Le paiement n'est pas configuré. Contactez le support." };
    }
    try {
      await simulatePlanChange({ userId: user.id, planId, interval });
      revalidatePath("/app/billing");
      revalidatePath("/app");
      return { ok: true, message: `Forfait ${planId} activé en mode démonstration (aucun paiement).` };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Changement impossible." };
    }
  }

  if (planId === "standard") {
    const url = await createBillingPortal(user.id).catch(() => null);
    if (!url) return { ok: false, error: "Utilisez le portail Stripe pour revenir au forfait Standard." };
    redirect(url);
  }

  const { createSubscriptionCheckout } = await import("@/lib/billing/stripe");
  const url = await createSubscriptionCheckout({
    userId: user.id,
    email: user.email,
    planId,
    interval
  }).catch(() => null);
  if (!url) return { ok: false, error: "Impossible d'ouvrir le paiement Stripe." };
  redirect(url);
}

export async function buyCreditsAction(_prev: BillingState, formData: FormData): Promise<BillingState> {
  const { user } = await requireUser();
  const amount = Math.round(Number(formData.get("amount") ?? 0) * 100);
  if (!Number.isFinite(amount) || amount < 200 || amount > 2000) {
    return { ok: false, error: "Choisissez un montant entre 2 € et 20 €." };
  }
  const context = await getAccountContext(user.id);
  if (context.planId === "standard") {
    return { ok: false, error: "Les crédits sont disponibles avec les forfaits Pro et Pro Famille." };
  }

  if (!getStripeStatus()) {
    if (!allowSimulation) return { ok: false, error: "Le paiement n'est pas configuré." };
    try {
      const balance = await simulateCreditsPurchase(user.id, amount);
      revalidatePath("/app/billing");
      return { ok: true, message: `Crédits ajoutés en mode démonstration. Nouveau solde : ${balance} crédits.` };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Achat impossible." };
    }
  }

  const { createCreditsCheckout } = await import("@/lib/billing/stripe");
  const url = await createCreditsCheckout({ userId: user.id, email: user.email, amountCents: amount }).catch(() => null);
  if (!url) return { ok: false, error: "Impossible d'ouvrir le paiement Stripe." };
  redirect(url);
}

function getStripeStatus(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

export async function manageSubscriptionAction(): Promise<void> {
  const { user } = await requireUser();
  if (getStripeStatus()) {
    const url = await createBillingPortal(user.id);
    redirect(url);
  }
  if (!allowSimulation) throw new Error("La gestion en ligne n'est pas disponible.");
  await simulateCancel(user.id);
  revalidatePath("/app/billing");
}

export async function grantDemoCreditsAction(): Promise<void> {
  const { user } = await requireUser();
  if (!allowSimulation) throw new Error("Action réservée à la démonstration.");
  const context = await getAccountContext(user.id);
  await addCredits({
    ownerType: context.walletOwnerType,
    ownerId: context.walletOwnerId,
    credits: 50,
    reason: "demo"
  });
  await audit({ actorId: user.id, action: "credits.demo", targetType: "wallet", targetId: context.walletOwnerId });
  revalidatePath("/app/billing");
}
