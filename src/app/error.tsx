"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[klerio]", error.digest ?? "erreur");
  }, [error]);

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md text-center">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700 dark:text-brand-300">Un imprévu</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Klerio a rencontré un problème.</h1>
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
          Vos documents sont conservés. Réessayez, ou revenez à l'accueil. Aucune action n'a été envoyée à une
          administration.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={reset} className="btn-primary">Réessayer</button>
          <Link href="/app" className="btn-secondary">Mon espace</Link>
        </div>
      </div>
    </div>
  );
}
