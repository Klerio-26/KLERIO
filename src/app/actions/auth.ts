"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, clientMeta } from "@/lib/auth/session";
import { verifyTotp } from "@/lib/auth/totp";
import { rateLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/audit";
import { isEmail, passwordIssues } from "@/lib/utils";

export interface AuthState {
  ok: boolean;
  error?: string;
  needs2fa?: boolean;
}

function parisDay(date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", day: "numeric" }).format(date));
}

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const meta = await clientMeta();
  const limit = rateLimit(`register:${meta.ip ?? "unknown"}`, 8, 3600_000);
  if (!limit.ok) return { ok: false, error: "Trop de tentatives. Réessayez dans une heure." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const accept = formData.get("accept") === "on";

  if (!isEmail(email)) return { ok: false, error: "Cette adresse e-mail ne semble pas valide." };
  const issues = passwordIssues(password);
  if (issues.length > 0) {
    return { ok: false, error: `Choisissez un mot de passe avec ${issues.join(", ")}.` };
  }
  if (!accept) return { ok: false, error: "Vous devez accepter les conditions et la politique de confidentialité." };

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "Un compte existe déjà avec cette adresse. Connectez-vous." };
  }

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({
    data: {
      email,
      name: name || null,
      passwordHash,
      subscription: {
        create: {
          planId: "standard",
          billingInterval: "monthly",
          status: "active",
          anchorDay: parisDay(),
          currentPeriodStart: new Date()
        }
      },
      consents: {
        createMany: {
          data: [
            { type: "terms", version: "2026-10" },
            { type: "privacy", version: "2026-10" },
            { type: "ai_processing", version: "2026-10" }
          ]
        }
      }
    }
  });

  await createSession(user.id);
  await audit({ actorId: user.id, action: "auth.register", targetType: "user", targetId: user.id, ip: meta.ip });
  redirect("/app?bienvenue=1");
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const meta = await clientMeta();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  const next = String(formData.get("next") ?? "");

  const limit = rateLimit(`login:${meta.ip ?? "unknown"}:${email}`, 6, 15 * 60_000);
  if (!limit.ok) {
    return { ok: false, error: `Trop de tentatives. Réessayez dans ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).` };
  }
  if (!isEmail(email) || !password) {
    return { ok: false, error: "Renseignez votre adresse e-mail et votre mot de passe." };
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) return { ok: false, error: "Adresse e-mail ou mot de passe incorrect." };
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await audit({ action: "auth.login.failed", targetType: "user", targetId: user.id, ip: meta.ip });
    return { ok: false, error: "Adresse e-mail ou mot de passe incorrect." };
  }

  if (user.twoFactorEnabled) {
    if (!code) return { ok: false, needs2fa: true, error: "Saisissez le code à 6 chiffres de votre application d'authentification." };
    if (!user.twoFactorSecret || !verifyTotp(user.twoFactorSecret, code)) {
      return { ok: false, needs2fa: true, error: "Code incorrect ou expiré. Réessayez." };
    }
  }

  await createSession(user.id);
  await audit({ actorId: user.id, action: "auth.login", targetType: "user", targetId: user.id, ip: meta.ip });
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app";
  redirect(safeNext);
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
