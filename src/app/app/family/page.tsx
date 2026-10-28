import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Crown, FolderLock, HardDrive, LockKeyhole, ShieldCheck, UserMinus, Users } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getAccountSnapshot } from "@/lib/quota/service";
import { getFamilyOverview } from "@/lib/family";
import { GB, formatBytes, formatPrice, PLANS, storageRatio } from "@/lib/quota/plans";
import { removeMemberAction, leaveFamilyAction, deleteFamilyAction } from "@/app/actions/family";
import { formatDate } from "@/lib/utils";
import { Alert, Badge, Card, Progress, SectionHeader, StatCard } from "@/components/ui";
import { CreateFamilyForm, FamilySettingsForm, InviteMemberForm } from "@/components/family-client";
import { ConfirmButton } from "@/components/confirm-button";

export const metadata: Metadata = { title: "Famille" };
export const dynamic = "force-dynamic";

export default async function FamilyPage() {
  const { user } = await requireUser();
  const snapshot = await getAccountSnapshot(user.id);
  const overview = await getFamilyOverview(user.id);

  if (!overview) {
    if (snapshot.context.planId !== "family") {
      return (
        <div className="space-y-6">
          <header>
            <p className="section-title">Pro Famille</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">Un espace pour chacun, un seul abonnement.</h1>
            <p className="mt-2 max-w-2xl text-sm text-ink-600 dark:text-ink-300">
              Jusqu'à 5 personnes, 100 pages de scan par mois et par personne, 50 Go partagés. Les documents restent
              privés par défaut : l'administrateur ne voit rien sans partage explicite.
            </p>
          </header>
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <h2 className="text-xl font-black">{PLANS.family.name}</h2>
              <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{PLANS.family.tagline}</p>
              <p className="mt-3 text-3xl font-black">
                {formatPrice(PLANS.family.priceMonthlyCents)}
                <span className="text-sm font-semibold text-ink-500 dark:text-ink-400"> / mois TTC</span>
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                {PLANS.family.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link href="/app/billing" className="btn-primary mt-5">
                Découvrir et changer de forfait <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Card>
            <Card className="bg-brand-50/60 dark:bg-brand-950/20">
              <h2 className="font-bold">Comment ça marche</h2>
              <ol className="mt-3 space-y-3 text-sm">
                <li><strong>1.</strong> L'administrateur active Pro Famille et crée le groupe.</li>
                <li><strong>2.</strong> Il invite jusqu'à 4 autres personnes par e-mail.</li>
                <li><strong>3.</strong> Chacun scanne et range ses documents dans son espace privé.</li>
                <li><strong>4.</strong> Le stockage et les crédits sont partagés ; les documents ne le sont pas, sauf action explicite.</li>
                <li><strong>5.</strong> Un membre peut partir à tout moment et exporter ses documents.</li>
              </ol>
            </Card>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <header>
          <p className="section-title">Votre groupe famille</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Créez votre espace famille.</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-600 dark:text-ink-300">
            Vous êtes administrateur. Invitez ensuite jusqu'à 4 personnes. Chaque membre garde un coffre privé.
          </p>
        </header>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-4 font-bold">Nom du groupe</h2>
            <CreateFamilyForm />
          </Card>
          <Card className="bg-brand-50/60 dark:bg-brand-950/20">
            <h2 className="font-bold">Ce qui sera partagé</h2>
            <ul className="mt-2 space-y-2 text-sm">
              <li className="flex gap-2"><HardDrive className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> Le pool de stockage de 50 Go</li>
              <li className="flex gap-2"><FolderLock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> Les crédits achetés</li>
              <li className="flex gap-2"><Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> Les rappels marqués « famille »</li>
              <li className="flex gap-2"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> <strong>Pas</strong> les documents privés</li>
            </ul>
          </Card>
        </div>
      </div>
    );
  }

  const isAdmin = overview.role === "admin";
  const ratio = storageRatio(overview.storage.usedBytes, overview.storage.limitBytes);
  const remaining = Math.max(0, overview.storage.limitBytes - overview.storage.usedBytes);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-title">Pro Famille</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">{overview.group.name}</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-600 dark:text-ink-300">
            {overview.members.length} / {overview.maxMembers} personnes.{" "}
            {isAdmin ? "Vous êtes administrateur du groupe." : "Vous êtes membre du groupe."} Vos documents privés ne
            sont jamais visibles par les autres.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">{overview.group.quotaPolicy === "shared" ? "Quotas IA partagés" : "Quotas IA répartis"}</Badge>
          <Badge tone="success">Documents privés par défaut</Badge>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Stockage du groupe"
          value={`${formatBytes(overview.storage.usedBytes)} / ${formatBytes(overview.storage.limitBytes)}`}
          hint={`${formatBytes(remaining)} encore disponibles`}
          icon={<HardDrive className="h-5 w-5" aria-hidden="true" />}
          tone="sky"
        />
        <StatCard
          label="Membres"
          value={`${overview.members.length} / ${overview.maxMembers}`}
          hint="Administrateur inclus"
          icon={<Users className="h-5 w-5" aria-hidden="true" />}
        />
        <StatCard
          label="Vos crédits famille"
          value={`${snapshot.credits} crédits`}
          hint="Partagés entre les membres"
          icon={<Crown className="h-5 w-5" aria-hidden="true" />}
          tone="amber"
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-bold">Pool de stockage unique</p>
            <p className="hint">Les 50 Go sont partagés. Chaque membre voit sa consommation personnelle ci-dessous.</p>
          </div>
          <span className="text-sm font-bold">{Math.round(ratio * 100)} %</span>
        </div>
        <div className="mt-2">
          <Progress value={ratio * 100} tone={ratio >= 0.9 ? "danger" : ratio >= 0.8 ? "warning" : "brand"} label="Stockage famille utilisé" />
        </div>
        {ratio >= 0.8 && (
          <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
            Alerte : le pool famille est utilisé à {Math.round(ratio * 100)} %. Aucun document n'est supprimé
            automatiquement.
          </p>
        )}
      </Card>

      <section>
        <SectionHeader
          title="Les membres"
          description="Chaque personne a son propre coffre. L'administrateur voit les volumes, jamais le contenu privé."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {overview.members.map((member) => {
            const personalPct = member.storageLimitBytes
              ? Math.min(100, (member.usedBytes / member.storageLimitBytes) * 100)
              : Math.min(100, (member.usedBytes / overview.storage.limitBytes) * 100);
            return (
              <Card key={member.userId} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold">
                      {member.name ?? member.email}
                      {member.userId === user.id && <span className="ml-1 text-xs font-normal text-ink-400">(vous)</span>}
                    </p>
                    <p className="truncate text-xs text-ink-500 dark:text-ink-400">{member.email}</p>
                  </div>
                  <Badge tone={member.role === "admin" ? "brand" : "neutral"}>
                    {member.role === "admin" ? "Admin" : "Membre"}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span>{formatBytes(member.usedBytes)} utilisés</span>
                  <span>{member.storageLimitBytes ? `limite ${formatBytes(member.storageLimitBytes)}` : "sans limite individuelle"}</span>
                </div>
                <div className="mt-1.5">
                  <Progress value={personalPct} tone={personalPct >= 90 ? "danger" : personalPct >= 80 ? "warning" : "brand"} label={`Stockage de ${member.name ?? member.email}`} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-xs text-ink-500 dark:text-ink-400">{member.documentCount} document(s)</p>
                  {isAdmin && member.userId !== user.id && (
                    <form action={removeMemberAction}>
                      <input type="hidden" name="memberId" value={member.userId} />
                      <ConfirmButton
                        message="Ses documents seront détachés du groupe et deviendront privés. Il pourra les exporter."
                        className="btn-ghost text-xs"
                        confirmLabel="Retirer"
                      >
                        <UserMinus className="h-3.5 w-3.5" aria-hidden="true" /> Retirer
                      </ConfirmButton>
                    </form>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {isAdmin && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionHeader title="Inviter un membre" description="L'invitation est nominative et expire en 7 jours." />
            <InviteMemberForm />
            {overview.invitations.length > 0 && (
              <div className="mt-4">
                <p className="section-title mb-2">Invitations en attente</p>
                <ul className="space-y-1.5 text-sm">
                  {overview.invitations.map((invitation) => (
                    <li key={invitation.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{invitation.email}</span>
                      <span className="shrink-0 text-xs text-ink-500 dark:text-ink-400">expire le {formatDate(invitation.expiresAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card>
            <SectionHeader title="Réglages du groupe" description="Politique de quotas et limites de stockage." />
            <FamilySettingsForm
              name={overview.group.name}
              policy={overview.group.quotaPolicy}
              members={overview.members.map((member) => ({
                userId: member.userId,
                name: member.name,
                email: member.email,
                role: member.role,
                limitGb: member.storageLimitBytes ? Math.round((member.storageLimitBytes / GB) * 10) / 10 : null
              }))}
            />
          </Card>
        </div>
      )}

      <Card className="border-ink-200 bg-ink-50/60 dark:border-ink-800 dark:bg-ink-900/40">
        <h2 className="font-bold">Départ et confidentialité</h2>
        <div className="mt-2 space-y-2 text-sm text-ink-600 dark:text-ink-300">
          <p>
            Un membre peut quitter le groupe quand il le souhaite. Ses documents sont alors détachés du pool, rendus
            privés, et il peut les exporter. Ils ne restent jamais accessibles aux autres.
          </p>
          <p>
            Si un membre part alors que son stockage dépasse son forfait personnel, son coffre passe en lecture seule
            avec 60 jours de grâce, sans suppression.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {!isAdmin ? (
            <form action={leaveFamilyAction}>
              <ConfirmButton message="Quitter le groupe ? Vos documents seront détachés et resteront privés." className="btn-secondary text-xs">
                Quitter le groupe
              </ConfirmButton>
            </form>
          ) : (
            <form action={deleteFamilyAction}>
              <ConfirmButton message="Supprimer le groupe ? Tous les membres seront détachés, sans perdre leurs documents." className="btn-danger text-xs">
                Supprimer le groupe
              </ConfirmButton>
            </form>
          )}
          <Link href="/app/billing" className="btn-ghost text-xs">Gérer le forfait</Link>
        </div>
      </Card>

      <Alert tone="info" title="Documents privés par défaut">
        L'administrateur voit les volumes de stockage et les rappels familiaux, mais jamais le contenu des documents
        privés. Un document n'est visible par le groupe que si son propriétaire le partage explicitement depuis sa
        fiche.
      </Alert>
    </div>
  );
}
