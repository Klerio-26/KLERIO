"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, revokeAllSessions } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { generateTotpSecret, otpauthUrl, verifyTotp } from "@/lib/auth/totp";
import { audit } from "@/lib/audit";
import { passwordIssues } from "@/lib/utils";
import { deleteFamilyGroup, leaveFamilyGroup } from "@/lib/family";
import { getStripe } from "@/lib/billing/stripe";

export interface AccountState {
  ok: boolean;
  error?: string;
  message?: string;
  secret?: string;
  otpauth?: string;
}

export async function updateProfileAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const { user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const locale = String(formData.get("locale") ?? "fr") === "en" ? "en" : "fr";
  const timezone = String(formData.get("timezone") ?? "Europe/Paris");
  if (timezone !== "Europe/Paris") {
    return { ok: false, error: "Seul le fuseau Europe/Paris est disponible pour le moment." };
  }
  await db.user.update({ where: { id: user.id }, data: { name: name || null, locale, timezone } });
  revalidatePath("/app/account");
  return { ok: true, message: "Profil enregistré." };
}

export async function changePasswordAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const { user, sessionId } = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const record = await db.user.findUnique({ where: { id: user.id } });
  if (!record || !(await verifyPassword(current, record.passwordHash))) {
    return { ok: false, error: "Mot de passe actuel incorrect." };
  }
  const issues = passwordIssues(next);
  if (issues.length > 0) return { ok: false, error: `Le nouveau mot de passe doit contenir ${issues.join(", ")}.` };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  const revoked = await revokeAllSessions(user.id, sessionId);
  await audit({ actorId: user.id, action: "account.password", targetType: "user", targetId: user.id, metadata: { revoked } });
  return { ok: true, message: `Mot de passe modifié. ${revoked} autre(s) session(s) déconnectée(s).` };
}

export async function start2faAction(_prev: AccountState, _formData: FormData): Promise<AccountState> {
  const { user } = await requireUser();
  const secret = generateTotpSecret();
  await db.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret, twoFactorEnabled: false } });
  return {
    ok: true,
    secret,
    otpauth: otpauthUrl(user.email, secret),
    message: "Scannez l'URI dans votre application, puis saisissez le code à 6 chiffres."
  };
}

export async function confirm2faAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const { user } = await requireUser();
  const code = String(formData.get("code") ?? "");
  const record = await db.user.findUnique({ where: { id: user.id } });
  if (!record?.twoFactorSecret) return { ok: false, error: "Commencez par générer une clé." };
  if (!verifyTotp(record.twoFactorSecret, code)) return { ok: false, error: "Code incorrect. Vérifiez l'heure de votre téléphone." };
  await db.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
  await audit({ actorId: user.id, action: "account.2fa.enable", targetType: "user", targetId: user.id });
  revalidatePath("/app/account");
  return { ok: true, message: "Double authentification activée." };
}

export async function disable2faAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const { user } = await requireUser();
  const password = String(formData.get("password") ?? "");
  const record = await db.user.findUnique({ where: { id: user.id } });
  if (!record || !(await verifyPassword(password, record.passwordHash))) {
    return { ok: false, error: "Mot de passe incorrect." };
  }
  await db.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null }
  });
  await audit({ actorId: user.id, action: "account.2fa.disable", targetType: "user", targetId: user.id });
  revalidatePath("/app/account");
  return { ok: true, message: "Double authentification désactivée." };
}

export async function revokeSessionsAction(): Promise<void> {
  const { user, sessionId } = await requireUser();
  const count = await revokeAllSessions(user.id, sessionId);
  await audit({ actorId: user.id, action: "account.sessions.revoke", targetType: "user", targetId: user.id, metadata: { count } });
  revalidatePath("/app/account");
}

export async function deleteAccountAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const { user } = await requireUser();
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  if (confirmation !== "SUPPRIMER") {
    return { ok: false, error: "Tapez SUPPRIMER pour confirmer." };
  }
  const record = await db.user.findUnique({ where: { id: user.id } });
  if (!record || !(await verifyPassword(password, record.passwordHash))) {
    return { ok: false, error: "Mot de passe incorrect." };
  }

  // Quitter proprement le groupe famille : les documents des autres membres ne doivent pas rester orphelins.
  try {
    const membership = await db.familyMember.findUnique({ where: { userId: user.id } });
    if (membership?.role === "admin") {
      await deleteFamilyGroup(user.id);
    } else if (membership) {
      await leaveFamilyGroup(user.id);
    }
  } catch (error) {
    console.error("[account.delete] famille", error instanceof Error ? error.message : "inconnu");
  }

  // Annuler l'abonnement Stripe s'il existe.
  try {
    const subscription = await db.subscription.findUnique({ where: { userId: user.id } });
    const stripe = getStripe();
    if (stripe && subscription?.stripeSubscriptionId) {
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    }
  } catch (error) {
    console.error("[account.delete] stripe", error instanceof Error ? error.message : "inconnu");
  }

  const now = new Date();
  await db.$transaction([
    db.document.updateMany({
      where: { ownerId: user.id, status: "active" },
      data: { status: "trash", deletedAt: now, purgeAt: new Date(now.getTime() + 30 * 86400000) }
    }),
    db.reminder.updateMany({ where: { userId: user.id }, data: { status: "cancelled" } }),
    db.familyMember.deleteMany({ where: { userId: user.id } }),
    db.subscription.updateMany({
      where: { userId: user.id },
      data: { status: "canceled", planId: "standard", cancelAtPeriodEnd: true }
    }),
    db.user.update({
      where: { id: user.id },
      data: {
        deletedAt: now,
        email: `supprime+${user.id}@klerio.invalid`,
        name: null,
        passwordHash: await hashPassword(crypto.randomUUID()),
        twoFactorSecret: null,
        twoFactorEnabled: false
      }
    })
  ]);
  await revokeAllSessions(user.id);
  await audit({ actorId: user.id, action: "account.delete", targetType: "user", targetId: user.id });
  redirect("/?compte=supprime");
}
