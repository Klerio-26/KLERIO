import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Download,
  FolderLock,
  ScanLine,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2
} from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getAccessibleDocument } from "@/lib/storage/service";
import { purgeDocument, restoreDocument, trashDocument } from "@/lib/storage/service";
import { purgeDocumentAction, restoreDocumentAction, shareDocumentAction, trashDocumentAction } from "@/app/actions/documents";
import { formatBytes } from "@/lib/quota/plans";
import { formatDate, formatDateTime, parseJsonArray } from "@/lib/utils";
import { Alert, Badge, Card } from "@/components/ui";
import { DocumentMetadataForm } from "@/components/document-meta-form";
import { ConfirmButton } from "@/components/confirm-button";
import { ClassifyButton } from "@/components/classify-button";
import { getAccountSnapshot } from "@/lib/quota/service";
import { RefreshOnMount } from "@/components/refresh-on-mount";

export const metadata: Metadata = { title: "Document" };
export const dynamic = "force-dynamic";

export default async function DocumentPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nouveau?: string }>;
}) {
  const { user, familyGroupId } = await requireUser();
  const { id } = await params;
  const { nouveau } = await searchParams;

  const accessible = await getAccessibleDocument(user.id, id);
  if (!accessible) notFound();
  const doc = await db.document.findUnique({
    where: { id },
    include: { category: true, owner: { select: { name: true, email: true } } }
  });
  if (!doc) notFound();

  const isOwner = doc.ownerId === user.id;
  const categories = isOwner
    ? await db.category.findMany({
        where: { OR: [{ ownerId: null }, { ownerId: user.id }] },
        orderBy: [{ isSystem: "desc" }, { label: "asc" }],
        select: { id: true, label: true }
      })
    : [];
  const tags = parseJsonArray(doc.tags);
  const snapshot = isOwner ? await getAccountSnapshot(user.id) : null;

  return (
    <div className="space-y-6">
      {nouveau && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          Document enregistré et chiffré. Il est maintenant dans votre coffre-fort.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/app/vault" className="btn-ghost px-0">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Retour au coffre
        </Link>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/documents/${doc.id}/file?download=1`} className="btn-secondary">
            <Download className="h-4 w-4" aria-hidden="true" /> Télécharger
          </a>
          <Link href={`/app/assistant?document=${doc.id}`} className="btn-primary">
            <Sparkles className="h-4 w-4" aria-hidden="true" /> Comprendre ce document
          </Link>
        </div>
      </div>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">{doc.category?.label ?? "Non classé"}</Badge>
          {doc.status === "trash" && <Badge tone="warning">Dans la corbeille</Badge>}
          {doc.visibility === "family" && (
            <Badge tone="success">
              <FolderLock className="h-3 w-3" aria-hidden="true" /> Partagé famille
            </Badge>
          )}
          {!isOwner && <Badge tone="info">Partagé par {doc.owner.name ?? "un membre"}</Badge>}
        </div>
        <h1 className="mt-2 text-3xl font-black tracking-tight">{doc.title}</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          {doc.pageCount} page{doc.pageCount > 1 ? "s" : ""} · {formatBytes(doc.sizeBytes)} · ajouté le{" "}
          {formatDateTime(doc.createdAt)}
          {doc.dueDate ? ` · échéance le ${formatDate(doc.dueDate)}` : ""}
        </p>
      </header>

      {doc.status === "trash" && (
        <Alert tone="warning" title="Ce document est dans la corbeille">
          Il compte encore dans votre stockage. Suppression définitive prévue le{" "}
          {formatDate(doc.purgeAt)}. Vous pouvez le restaurer ou le supprimer tout de suite.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 dark:border-ink-800">
            <p className="text-sm font-bold">Aperçu</p>
            <span className="text-xs text-ink-500 dark:text-ink-400">Chiffré au repos</span>
          </div>
          <div className="min-h-[420px] bg-ink-100 dark:bg-ink-950">
            {doc.mimeType === "application/pdf" ? (
              <iframe
                src={`/api/documents/${doc.id}/file`}
                title={`Aperçu de ${doc.title}`}
                className="h-[70vh] w-full"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/documents/${doc.id}/file`}
                alt={`Aperçu de ${doc.title}`}
                className="mx-auto max-h-[70vh] w-auto object-contain"
              />
            )}
          </div>
        </Card>

        <div className="space-y-4">
          {isOwner ? (
            <Card>
              <h2 className="mb-4 font-bold">Informations</h2>
              <div className="mb-4">
                <ClassifyButton
                  documentId={doc.id}
                  text={doc.ocrText ?? doc.title}
                  creditsEnabled={Boolean(snapshot?.context.plan.creditsEnabled)}
                />
                <p className="hint mt-1">Le classement IA consomme 1 unité du quota « classement ». Le classement manuel reste gratuit.</p>
              </div>
              <DocumentMetadataForm
                doc={{
                  id: doc.id,
                  title: doc.title,
                  categoryId: doc.categoryId,
                  dueDate: doc.dueDate,
                  tags: doc.tags
                }}
                categories={categories}
              />
            </Card>
          ) : (
            <Card>
              <h2 className="font-bold">Document partagé</h2>
              <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
                Ce document vous a été partagé explicitement par {doc.owner.name ?? doc.owner.email}. Vous pouvez le
                consulter et le télécharger, mais seul son propriétaire peut le modifier ou le supprimer.
              </p>
            </Card>
          )}

          {tags.length > 0 && (
            <Card>
              <p className="section-title mb-2">Mots-clés</p>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <Link key={t} href={`/app/vault?tag=${encodeURIComponent(t)}`} className="chip">
                    #{t}
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {isOwner && (
            <Card>
              <h2 className="font-bold">Actions</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/app/reminders?document=${doc.id}&title=${encodeURIComponent(`Penser à : ${doc.title}`)}`}
                  className="btn-secondary text-xs"
                >
                  <CalendarClock className="h-4 w-4" aria-hidden="true" /> Créer un rappel
                </Link>
                {familyGroupId && (
                  <form action={shareDocumentAction}>
                    <input type="hidden" name="id" value={doc.id} />
                    <input type="hidden" name="share" value={doc.visibility === "family" ? "0" : "1"} />
                    <button type="submit" className="btn-secondary text-xs">
                      <Share2 className="h-4 w-4" aria-hidden="true" />
                      {doc.visibility === "family" ? "Rendre privé" : "Partager avec la famille"}
                    </button>
                  </form>
                )}
                {doc.status === "active" ? (
                  <form action={trashDocumentAction}>
                    <input type="hidden" name="id" value={doc.id} />
                    <ConfirmButton message="Mettre ce document à la corbeille ?" className="btn-ghost text-xs">
                      <Trash2 className="h-4 w-4" aria-hidden="true" /> Mettre à la corbeille
                    </ConfirmButton>
                  </form>
                ) : (
                  <>
                    <form action={restoreDocumentAction}>
                      <input type="hidden" name="id" value={doc.id} />
                      <button type="submit" className="btn-secondary text-xs">Restaurer</button>
                    </form>
                    <form action={purgeDocumentAction}>
                      <input type="hidden" name="id" value={doc.id} />
                      <input type="hidden" name="confirm" value="on" />
                      <ConfirmButton message="Effacer définitivement ? Cette action est irréversible." className="btn-danger text-xs">
                        <Trash2 className="h-4 w-4" aria-hidden="true" /> Supprimer définitivement
                      </ConfirmButton>
                    </form>
                  </>
                )}
              </div>
              <p className="hint mt-3">
                La corbeille conserve le document 30 jours et l'inclut dans le stockage. Aucune suppression
                automatique n'a lieu sans cette échéance affichée.
              </p>
            </Card>
          )}

          {doc.ocrText && (
            <Card>
              <details>
                <summary className="cursor-pointer text-sm font-bold">Texte extrait ou saisi</summary>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-ink-50 p-3 text-xs leading-relaxed dark:bg-ink-950">
                  {doc.ocrText.slice(0, 5000)}
                </pre>
              </details>
            </Card>
          )}

          <Card className="bg-ink-50/70 dark:bg-ink-900/60">
            <p className="text-xs leading-relaxed text-ink-500 dark:text-ink-400">
              <ShieldCheck className="mr-1 inline h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              Fichier chiffré avec une clé propre, elle-même protégée par la clé maître Klerio. L'aperçu est servi
              uniquement à votre session. Aucune donnée n'est utilisée pour entraîner un modèle d'IA.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
