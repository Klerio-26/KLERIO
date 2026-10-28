"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { applyCategoryAction } from "@/app/actions/classify";
import { categoryLabel } from "@/lib/categories";

export function ClassifyButton({
  documentId,
  text,
  creditsEnabled
}: {
  documentId: string;
  text: string;
  creditsEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState(false);

  async function classify() {
    setBusy(true);
    setError(null);
    setMessage(null);
    setQuotaError(false);
    try {
      const response = await fetch("/api/ai/classify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: text || "Document administratif", fileName: "document.pdf" })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Classement impossible.");
        if (response.status === 402) setQuotaError(true);
        return;
      }
      const slug = String(data.detection?.categorySlug ?? "autre");
      const form = new FormData();
      form.set("documentId", documentId);
      form.set("slug", slug);
      startTransition(async () => {
        try {
          await applyCategoryAction(form);
          setMessage(`Classé dans « ${categoryLabel(slug)} ».`);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Impossible d'appliquer la catégorie.");
        }
      });
    } catch {
      setError("Classement impossible. Vérifiez votre connexion.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" className="btn-secondary text-xs" onClick={classify} disabled={busy || pending}>
        {busy || pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
        {busy || pending ? "Classement…" : "Classer automatiquement (IA)"}
      </button>
      {message && <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{message}</p>}
      {error && (
        <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
          {error}
          {quotaError && (
            <>
              {" "}
              <Link href="/app/billing" className="link">
                Voir les forfaits
              </Link>
              {!creditsEnabled && " ou passer à Pro"}
            </>
          )}
        </p>
      )}
    </div>
  );
}
