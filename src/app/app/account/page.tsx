import type { Metadata } from "next";
import Link from "next/link";
import { Download, ExternalLink, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser, listSessions } from "@/lib/auth/session";
import { logoutAction } from "@/app/actions/auth";
import { revokeSessionsAction } from "@/app/actions/account";
import { getAccountSnapshot } from "@/lib/quota/service";
import { formatDateTime, formatDate } from "@/lib/utils";
import { Badge, Card, SectionHeader } from "@/components/ui";
import { DeleteAccountForm, PasswordForm, ProfileForm, TwoFactorPanel } from "@/components/account-client";
import { ConfirmButton } from "@/components/confirm-button";

export const metadata: Metadata = { title: "Mon compte" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { user, sessionId } = await requireUser();
  const record = await db.user.findUnique({ where: { id: user.id } });
  const sessions = await listSessions(user.id);
  const snapshot = await getAccountSnapshot(user.id);
  const audits = await db.auditLog.findMany({
    where: { actorId: user.id },
    orderBy: { createdAt: "desc" },
    take: 12
  });
  const consents = await db.consent.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { grantedAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-title">Mon compte</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">{user.name ?? user.email}</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            {user.email} · membre depuis le {formatDate(user.createdAt)} · forfait {snapshot.context.plan.name}
          </p>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="btn-secondary">
            <LogOut className="h-4 w-4" aria-hidden="true" /> Se déconnecter
          </button>
        </form>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Profil" description="Ces informations ne sont jamais partagées avec les administrations." />
          <ProfileForm name={record?.name ?? ""} locale={record?.locale ?? "fr"} />
        </Card>

        <Card>
          <SectionHeader title="Mot de passe" description="Un mot de passe unique, différent de vos autres comptes." />
          <PasswordForm />
        </Card>

        <Card>
          <SectionHeader title="Double authentification" description="Une protection supplémentaire contre le vol de mot de passe." />
          <TwoFactorPanel enabled={Boolean(record?.twoFactorEnabled)} />
        </Card>

        <Card>
          <SectionHeader
            title="Sessions actives"
            description="Si vous ne reconnaissez pas une session, révoquez-la immédiatement."
            action={
              <form action={revokeSessionsAction}>
                <ConfirmButton message="Déconnecter toutes les autres sessions ?" className="btn-ghost text-xs">
                  Tout révoquer
                </ConfirmButton>
              </form>
            }
          />
          <ul className="divide-y divide-ink-100 dark:divide-ink-800">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-start justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {session.id === sessionId ? "Cette session" : "Autre session"}
                    {session.ip ? ` · ${session.ip}` : ""}
                  </p>
                  <p className="truncate text-xs text-ink-500 dark:text-ink-400">
                    {session.userAgent ?? "Appareil inconnu"} · ouverte le {formatDateTime(session.createdAt)}
                  </p>
                </div>
                <Badge tone={session.id === sessionId ? "success" : "neutral"}>
                  {session.id === sessionId ? "Actuelle" : "Active"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Vos données (RGPD)" description="Accès, export, rectification et effacement." />
          <div className="space-y-3 text-sm">
            <a href="/api/account/export" className="btn-secondary w-full text-xs">
              <Download className="h-4 w-4" aria-hidden="true" /> Exporter toutes mes données (JSON)
            </a>
            <p className="text-xs text-ink-500 dark:text-ink-400">
              L'export contient votre profil, vos documents (métadonnées et texte), vos rappels, vos factures et
              l'historique de consommation. Les fichiers eux-mêmes restent téléchargeables depuis le coffre-fort.
            </p>
            <Link href="/legal/confidentialite" className="link inline-flex items-center gap-1 text-xs">
              Politique de confidentialité <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-5 border-t border-ink-200 pt-4 dark:border-ink-800">
            <DeleteAccountForm />
          </div>
        </Card>

        <Card>
          <SectionHeader title="Consentements" description="Vous pouvez retirer votre consentement à tout moment." />
          <ul className="space-y-2 text-sm">
            {consents.map((consent) => (
              <li key={consent.id} className="flex items-center justify-between gap-2">
                <span>{consent.type.replaceAll("_", " ")}</span>
                <span className="text-xs text-ink-500 dark:text-ink-400">
                  version {consent.version} · {formatDate(consent.grantedAt)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
            <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            Les documents ne servent jamais à entraîner des modèles. Le traitement IA est décrit dans la politique de
            confidentialité. Vous pouvez utiliser Klerio sans IA pour la plupart des fonctions.
          </p>
        </Card>
      </div>

      <Card>
        <SectionHeader title="Journal d'audit" description="Les actions sensibles de votre compte, conservées pour votre sécurité." />
        {audits.length === 0 ? (
          <p className="text-sm text-ink-500 dark:text-ink-400">Aucune action sensible enregistrée.</p>
        ) : (
          <ul className="divide-y divide-ink-100 text-sm dark:divide-ink-800">
            {audits.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-2 py-2">
                <span className="font-mono text-xs">{entry.action}</span>
                <span className="text-xs text-ink-500 dark:text-ink-400">{formatDateTime(entry.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="bg-ink-50/60 dark:bg-ink-900/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-bold">Support et légal</p>
            <p className="text-xs text-ink-500 dark:text-ink-400">
              Mentions légales, CGU, CGV et confidentialité sont des brouillons à faire valider par un juriste.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/legal/mentions" className="btn-ghost text-xs">Mentions légales</Link>
            <Link href="/legal/cgu" className="btn-ghost text-xs">CGU</Link>
            <Link href="/legal/cgv" className="btn-ghost text-xs">CGV</Link>
            <Link href="/legal/confidentialite" className="btn-ghost text-xs">Confidentialité</Link>
          </div>
        </div>
      </Card>

      <p className="flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
        <Smartphone className="h-4 w-4" aria-hidden="true" />
        Klerio est une PWA : installez-la depuis le menu de votre navigateur pour un accès en un tap.
      </p>
    </div>
  );
}
