import Link from "next/link";
import { FileText, FolderLock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui";
import { categoryLabel } from "@/lib/categories";
import { dueLabel, formatDate } from "@/lib/utils";

export interface DocumentCardData {
  id: string;
  title: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number;
  dueDate: Date | null;
  status: string;
  visibility: string;
  category: { label: string } | null;
}

export function DocumentCard({ doc, showVisibility = false }: { doc: DocumentCardData; showVisibility?: boolean }) {
  const overdue = doc.dueDate && new Date(doc.dueDate) < new Date();
  return (
    <Link
      href={`/app/vault/${doc.id}`}
      className="group flex items-start gap-3 rounded-2xl border border-ink-200 bg-white p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40 dark:border-ink-800 dark:bg-ink-900 dark:hover:border-brand-700 dark:hover:bg-brand-950/20"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
        <FileText className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="line-clamp-2 text-sm font-bold leading-snug group-hover:text-brand-800 dark:group-hover:text-brand-200">
            {doc.title}
          </span>
          {doc.status === "trash" && <Badge tone="warning">Corbeille</Badge>}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500 dark:text-ink-400">
          <span>{doc.category?.label ?? "Non classé"}</span>
          <span aria-hidden="true">·</span>
          <span>{doc.pageCount} page{doc.pageCount > 1 ? "s" : ""}</span>
          {doc.dueDate && (
            <>
              <span aria-hidden="true">·</span>
              <span className={overdue ? "font-semibold text-red-600 dark:text-red-400" : ""}>
                {overdue ? "Échéance dépassée" : dueLabel(doc.dueDate)}
              </span>
            </>
          )}
          {showVisibility && doc.visibility === "family" && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-semibold text-brand-700 dark:text-brand-300">
                <FolderLock className="h-3 w-3" aria-hidden="true" /> Partagé famille
              </span>
            </>
          )}
        </span>
      </span>
    </Link>
  );
}

export function SecurityNote({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "flex items-start gap-2 text-xs text-ink-500 dark:text-ink-400" : "card flex items-start gap-3 p-4"}>
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
      <p className={compact ? "" : "text-sm text-ink-600 dark:text-ink-300"}>
        Vos documents sont chiffrés et hébergés en UE. Klerio ne les utilise jamais pour entraîner un modèle d'IA.
        {" "}Dernière vérification : {formatDate(new Date())}.
      </p>
    </div>
  );
}
