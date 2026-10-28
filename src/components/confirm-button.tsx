"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

export function ConfirmButton({
  children,
  message,
  className = "btn-danger",
  confirmLabel = "Confirmer"
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
  confirmLabel?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  if (!confirming) {
    return (
      <button type="button" className={className} onClick={() => setConfirming(true)}>
        {children}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-red-700 dark:text-red-300">{message}</span>
      <button
        type="submit"
        className="btn-danger min-h-[38px] px-3 py-1.5 text-xs"
        onClick={() => setPending(true)}
        disabled={pending}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
        {pending ? "Suppression…" : confirmLabel}
      </button>
      <button type="button" className="btn-ghost min-h-[38px] px-2 py-1.5 text-xs" onClick={() => setConfirming(false)} disabled={pending}>
        Annuler
      </button>
    </span>
  );
}


