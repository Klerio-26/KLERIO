import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Archive, FolderLock, Plus, RotateCcw, ScanLine, Search, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getAccountSnapshot } from "@/lib/quota/service";
import { formatBytes, storageRatio } from "@/lib/quota/plans";
import { formatDate, formatShortDate, parseJsonArray } from "@/lib/utils";
import { createCategoryAction } from "@/app/actions/categories";
import { emptyTrashAction, purgeDocumentAction, restoreDocumentAction } from "@/app/actions/documents";
import { Alert, Badge, Card, EmptyState, Progress } from "@/components/ui";
import { DocumentCard } from "@/components/document-card";
import { ConfirmButton } from "@/components/confirm-button";

export const metadata: Metadata = { title: "Mon coffre-fort" };
export const dynamic = "force-dynamic";

export default async function VaultPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; cat?: string; view?: string; tag?: string }>;
}) {
  const { user, familyGroupId } = await requireUser();
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const cat = params.cat ?? "";
  const view = params.view === "trash" ? "trash" : "active";
  const tag = params.tag ?? "";
  const snapshot = await getAccountSnapshot(user.id);

  const categories = await db.category.findMany({
    where: { OR: [{ ownerId: null }, { ownerId: user.id }] },
    orderBy: [{ isSystem: "desc" }, { label: "asc" }]
  });
  const activeCategory = categories.find((c) => c.id === cat);

  const accessWhere =
    view === "trash"
      ? { ownerId: user.id, status: "trash" }
      : {
          status: "active",
          OR: [
            { ownerId: user.id },
            ...(familyGroupId ? [{ groupId: familyGroupId, visibility: "family" }] : [])
          ]
        };

  const documents = await db.document.findMany({
    where: {
      AND: [
        accessWhere,
        ...(activeCategory ? [{ categoryId: activeCategory.id }] : []),
        ...(q
          ? [
              {
                OR: [
                  { title: { contains: q, mode: "insensitive" as const } },
                  { ocrText: { contains: q, mode: "insensitive" as const } },
                  { tags: { contains: q, mode: "insensitive" as const } }
                ]
              }
            ]
          : []),
        ...(tag ? [{ tags: { contains: tag } }] : [])
      ]
    },
    include: { category: { select: { label: true } } },
    orderBy: view === "trash" ? { deletedAt: "desc" } : { createdAt: "desc" }
  });

  const trashDocs = view === "trash" ? documents : [];
  const ratio = snapshot.storage.ratio;
  const used = formatBytes(snapshot.storage.usedBytes);
  const limit = formatBytes(snapshot.storage.limitBytes);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-title">Coffre-fort chiffré</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Mes documents</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-600 dark:text-ink-300">
            {documents.length} document{documents.length > 1 ? "s" : ""} {view === "trash" ? "dans la corbeille" : "classé" + (documents.length > 1 ? "s" : "")}.
            {" "}Recherchez par titre, mot-clé ou contenu.
          </p>
        </div>
        <Link href="/app/scan" className="btn-primary">
          <ScanLine className="h-4 w-4" aria-hidden="true" /> Scanner
        </Link>
      </header>

      <Card className="bg-brand-50/50 dark:bg-brand-950/20">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm font-bold">
              Stockage {familyGroupId ? "famille" : "personnel"} : {used} / {limit}
            </p>
            <p className="hint">
              {familyGroupId
                ? "Pool unique de 50 Go. Votre consommation personnelle est visible dans l'espace Famille."
                : "Le stockage est un quota distinct des pages de scan et des quotas IA."}
            </p>
          </div>
          <span className="text-sm font-bold">{Math.round(ratio * 100)} %</span>
        </div>
        <div className="mt-2">
          <Progress value={ratio * 100} tone={ratio >= 0.9 ? "danger" : ratio >= 0.8 ? "warning" : "brand"} label="Stockage utilisé" />
        </div>
        {ratio >= 0.8 && ratio < 1 && (
          <div className="mt-3">
            <Alert tone="warning" title={ratio >= 0.9 ? "Plus que quelques documents" : "Votre coffre se remplit"}>
              Vous avez utilisé {Math.round(ratio * 100)} % de votre espace. Vous pouvez supprimer des documents,
              vider la corbeille, ou changer de forfait. Aucun document ne sera supprimé automatiquement.
            </Alert>
          </div>
        )}
        {snapshot.storage.state === "read_only" && (
          <div className="mt-3">
            <Alert tone="danger" title="Coffre en lecture seule">
              Votre stockage dépasse la limite du forfait. Vos documents restent consultables et exportables
              {snapshot.storage.graceEndsAt ? ` jusqu'au ${formatDate(snapshot.storage.graceEndsAt)}` : ""}. Aucun
              document n'a été supprimé. Pensez à exporter ce qui compte.
            </Alert>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Affichage">
          <Link
            href={`/app/vault${q ? `?q=${encodeURIComponent(q)}` : ""}`}
            className={view === "active" ? "btn-primary px-3 py-1.5 text-xs" : "btn-secondary px-3 py-1.5 text-xs"}
            aria-current={view === "active" ? "page" : undefined}
          >
            <FolderLock className="h-3.5 w-3.5" aria-hidden="true" /> Documents
          </Link>
          <Link
            href="/app/vault?view=trash"
            className={view === "trash" ? "btn-primary px-3 py-1.5 text-xs" : "btn-secondary px-3 py-1.5 text-xs"}
            aria-current={view === "trash" ? "page" : undefined}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Corbeille
          </Link>
        </div>
        <form action="/app/vault" className="flex min-w-[240px] flex-1 items-center gap-2 sm:max-w-sm" role="search">
          {view === "trash" && <input type="hidden" name="view" value="trash" />}
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
            <input
              name="q"
              defaultValue={q}
              className="input pl-9"
              placeholder="Rechercher un document…"
              aria-label="Rechercher dans le coffre-fort"
            />
          </div>
          <button type="submit" className="btn-secondary shrink-0 px-3">Chercher</button>
        </form>
      </div>

      {view === "active" && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Filtrer par catégorie">
          <Link href="/app/vault" className={!cat ? "badge bg-brand-700 text-white" : "chip"}>
            Toutes
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/app/vault?cat=${category.id}`}
              className={cat === category.id ? "badge bg-brand-700 text-white" : "chip"}
            >
              {category.label}
            </Link>
          ))}
          <details className="relative">
            <summary className="chip cursor-pointer list-none">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Nouvelle catégorie
            </summary>
            <form action={createCategoryAction} className="card absolute left-0 top-9 z-20 w-64 space-y-2 p-3">
              <label htmlFor="label" className="label">Nom de la catégorie</label>
              <input id="label" name="label" className="input" maxLength={60} required placeholder="Ex. Mutuelle" />
              <button type="submit" className="btn-primary w-full py-2 text-xs">Créer</button>
            </form>
          </details>
        </div>
      )}

      {activeCategory && (
        <p className="text-sm text-ink-500 dark:text-ink-400">
          Catégorie : <strong>{activeCategory.label}</strong> ·{" "}
          <Link href="/app/vault" className="link">retirer le filtre</Link>
        </p>
      )}

      {documents.length === 0 ? (
        <EmptyState
          title={view === "trash" ? "La corbeille est vide" : q || cat ? "Aucun document ne correspond" : "Votre coffre est vide"}
          description={
            view === "trash"
              ? "Les documents supprimés restent ici 30 jours. Ils comptent dans le stockage jusqu'à leur suppression définitive."
              : "Scannez un document ou importez un PDF. Tout est chiffré avant d'être enregistré."
          }
          action={view === "trash" ? undefined : <Link href="/app/scan" className="btn-primary">Scanner un document</Link>}
        />
      ) : view === "trash" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-500 dark:text-ink-400">
              La corbeille compte dans le stockage jusqu'à sa vidange définitive (30 jours).
            </p>
            {trashDocs.length > 0 && (
              <form action={emptyTrashAction}>
                <ConfirmButton message="Vider définitivement toute la corbeille ?" className="btn-secondary text-xs">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Vider la corbeille
                </ConfirmButton>
              </form>
            )}
          </div>
          {trashDocs.map((doc) => (
            <Card key={doc.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold">{doc.title}</p>
                  <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                    {doc.category?.label ?? "Non classé"} · {formatBytes(doc.sizeBytes)} · supprimé le{" "}
                    {formatShortDate(doc.deletedAt)}
                    {doc.purgeAt ? ` · suppression définitive le ${formatShortDate(doc.purgeAt)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={restoreDocumentAction}>
                    <input type="hidden" name="id" value={doc.id} />
                    <button type="submit" className="btn-secondary text-xs">
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Restaurer
                    </button>
                  </form>
                  <form action={purgeDocumentAction}>
                    <input type="hidden" name="id" value={doc.id} />
                    <input type="hidden" name="confirm" value="on" />
                    <ConfirmButton message="Effacer pour toujours ?" className="btn-danger text-xs">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Supprimer
                    </ConfirmButton>
                  </form>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {documents.map((doc) => (
            <div key={doc.id} className="space-y-1.5">
              <DocumentCard doc={doc} showVisibility />
              <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-ink-500 dark:text-ink-400">
                {parseJsonArray(doc.tags).slice(0, 3).map((t) => (
                  <Link key={t} href={`/app/vault?tag=${encodeURIComponent(t)}`} className="chip px-2 py-0.5 text-[0.68rem]">
                    #{t}
                  </Link>
                ))}
                <span>{formatDate(doc.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "active" && documents.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
          <Archive className="h-4 w-4" aria-hidden="true" />
          Les documents partagés avec la famille portent la mention « Partagé famille ». Les autres restent privés,
          même pour l'administrateur.
        </p>
      )}

      {ratio >= 1 && (
        <Alert tone="danger" title="Coffre plein">
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Vous ne pouvez plus enregistrer de nouveaux documents. Le scan et le téléchargement local restent
            disponibles. Supprimez des documents ou passez à un forfait supérieur.
          </span>
        </Alert>
      )}

      {tag && (
        <p className="text-sm">
          Filtre actif : <Badge tone="brand">#{tag}</Badge>{" "}
          <Link href="/app/vault" className="link">tout afficher</Link>
        </p>
      )}
    </div>
  );
}
