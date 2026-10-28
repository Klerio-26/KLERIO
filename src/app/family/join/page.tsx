import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { sha256 } from "@/lib/security/crypto";
import { Card, Alert } from "@/components/ui";
import { JoinFamilyForm } from "@/components/join-family-form";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Rejoindre une famille" };
export const dynamic = "force-dynamic";

export default async function JoinFamilyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { user } = await requireUser();
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Alert tone="danger" title="Lien incomplet">Ce lien d'invitation ne contient pas de jeton.</Alert>
        <Link href="/app" className="btn-secondary">Retour à mon espace</Link>
      </div>
    );
  }

  const invitation = await db.familyInvitation.findUnique({
    where: { tokenHash: sha256(token) },
    include: { group: true, inviter: { select: { name: true, email: true } } }
  });

  if (!invitation || invitation.expiresAt < new Date() || invitation.acceptedAt) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Alert tone="danger" title="Invitation invalide ou expirée">
          Demandez à l'administrateur du groupe de vous renvoyer une invitation.
        </Alert>
        <Link href="/app" className="btn-secondary">Retour à mon espace</Link>
      </div>
    );
  }

  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Alert tone="danger" title="Mauvaise adresse e-mail">
          Cette invitation a été envoyée à une autre adresse. Connectez-vous avec le bon compte ou demandez une
          nouvelle invitation.
        </Alert>
        <Link href="/app" className="btn-secondary">Retour à mon espace</Link>
      </div>
    );
  }

  const existing = await db.familyMember.findUnique({ where: { userId: user.id } });
  if (existing) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Alert tone="info" title="Vous faites déjà partie d'un groupe">
          Un compte ne peut appartenir qu'à un seul groupe famille à la fois.
        </Alert>
        <Link href="/app/family" className="btn-secondary">Voir mon groupe</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Card>
        <p className="section-title">Invitation</p>
        <h1 className="mt-2 text-2xl font-black">{invitation.group.name}</h1>
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
          {invitation.inviter.name ?? invitation.inviter.email} vous invite à rejoindre son espace famille Klerio.
          L'invitation expire le {formatDate(invitation.expiresAt)}.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-ink-700 dark:text-ink-200">
          <li>• Vous conservez un coffre-fort privé.</li>
          <li>• L'administrateur ne voit jamais vos documents privés.</li>
          <li>• Le stockage de 50 Go et les crédits sont partagés.</li>
          <li>• Vous pouvez quitter le groupe et exporter vos documents à tout moment.</li>
        </ul>
        <div className="mt-5">
          <JoinFamilyForm token={token} />
        </div>
      </Card>
      <p className="text-center text-xs text-ink-500 dark:text-ink-400">
        Vous êtes connecté en tant que <strong>{user.email}</strong>.{" "}
        <Link href="/app" className="link">Annuler</Link>
      </p>
    </div>
  );
}
