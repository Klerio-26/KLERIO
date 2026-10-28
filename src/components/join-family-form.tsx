"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, Users } from "lucide-react";
import { acceptInvitationAction, type FamilyState } from "@/app/actions/family";

const initial: FamilyState = { ok: false };

export function JoinFamilyForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvitationAction, initial);

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
        <p className="font-bold">Bienvenue dans le groupe.</p>
        <p className="mt-1">Vos documents restent privés. Vous pouvez partager un document explicitement si vous le souhaitez.</p>
        <Link href="/app/family" className="btn-primary mt-3">Ouvrir l'espace famille</Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      {state.error && <p className="text-sm font-semibold text-red-600 dark:text-red-400" role="alert">{state.error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Users className="h-4 w-4" aria-hidden="true" />}
        Rejoindre le groupe
      </button>
    </form>
  );
}
