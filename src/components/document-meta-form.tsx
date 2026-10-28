"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";
import { updateDocumentAction, type ActionResult } from "@/app/actions/documents";

const initial: ActionResult = { ok: false };

export function DocumentMetadataForm({
  doc,
  categories
}: {
  doc: {
    id: string;
    title: string;
    categoryId: string | null;
    dueDate: Date | null;
    tags: string;
  };
  categories: Array<{ id: string; label: string }>;
}) {
  const [state, action, pending] = useActionState(updateDocumentAction, initial);
  const tags = (() => {
    try {
      const parsed = JSON.parse(doc.tags);
      return Array.isArray(parsed) ? parsed.join(", ") : "";
    } catch {
      return "";
    }
  })();
  const due = doc.dueDate ? new Date(doc.dueDate).toISOString().slice(0, 10) : "";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={doc.id} />
      <div>
        <label htmlFor="title" className="label">Nom du document</label>
        <input id="title" name="title" className="input" defaultValue={doc.title} maxLength={160} required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="categoryId" className="label">Catégorie</label>
          <select id="categoryId" name="categoryId" className="select" defaultValue={doc.categoryId ?? ""}>
            <option value="">Non classé</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dueDate" className="label">Échéance</label>
          <input id="dueDate" name="dueDate" type="date" className="input" defaultValue={due} />
        </div>
      </div>
      <div>
        <label htmlFor="tags" className="label">Mots-clés</label>
        <input id="tags" name="tags" className="input" defaultValue={tags} placeholder="loyer, 2026, assurance" />
        <p className="hint mt-1">Séparez les mots-clés par des virgules.</p>
      </div>

      {state.error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{state.error}</p>}
      {state.ok && state.message && <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{state.message}</p>}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
        Enregistrer les modifications
      </button>
    </form>
  );
}
