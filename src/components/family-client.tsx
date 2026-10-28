"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Loader2, MailPlus, Settings2, Users } from "lucide-react";
import {
  createFamilyAction,
  inviteMemberAction,
  updateFamilySettingsAction,
  type FamilyState
} from "@/app/actions/family";

const initial: FamilyState = { ok: false };

export function CreateFamilyForm() {
  const [state, action, pending] = useActionState(createFamilyAction, initial);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="family-name" className="label">Nom du groupe</label>
        <input id="family-name" name="name" className="input" placeholder="Ex. Famille Martin" maxLength={80} required />
      </div>
      {state.error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{state.error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Users className="h-4 w-4" aria-hidden="true" />}
        Créer mon groupe famille
      </button>
    </form>
  );
}

export function InviteMemberForm() {
  const [state, action, pending] = useActionState(inviteMemberAction, initial);
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="invite-email" className="label">Adresse e-mail du membre</label>
        <input id="invite-email" name="email" type="email" className="input" placeholder="membre@exemple.fr" required />
      </div>
      {state.error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{state.error}</p>}
      {state.ok && state.message && <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{state.message}</p>}
      {state.inviteUrl && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-xs dark:border-brand-800 dark:bg-brand-950/30">
          <p className="font-bold">Lien d'invitation (valable 7 jours)</p>
          <p className="mt-1 break-all text-ink-600 dark:text-ink-300">{state.inviteUrl}</p>
          <button
            type="button"
            className="btn-secondary mt-2 text-xs"
            onClick={async () => {
              await navigator.clipboard?.writeText(state.inviteUrl ?? "");
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            {copied ? "Copié" : "Copier le lien"}
          </button>
        </div>
      )}
      <button type="submit" className="btn-secondary w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MailPlus className="h-4 w-4" aria-hidden="true" />}
        Envoyer l'invitation
      </button>
    </form>
  );
}

export function FamilySettingsForm({
  name,
  policy,
  members
}: {
  name: string;
  policy: string;
  members: Array<{ userId: string; name: string | null; email: string; limitGb: number | null; role: string }>;
}) {
  const [state, action, pending] = useActionState(updateFamilySettingsAction, initial);
  const [selectedPolicy, setSelectedPolicy] = useState(policy === "per_member" ? "per_member" : "shared");

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="group-name" className="label">Nom du groupe</label>
        <input id="group-name" name="name" className="input" defaultValue={name} maxLength={80} />
      </div>
      <fieldset>
        <legend className="label">Politique de quotas IA</legend>
        <div className="space-y-2 text-sm">
          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${selectedPolicy === "shared" ? "border-brand-500 bg-brand-50/60 dark:bg-brand-950/20" : "border-ink-200 dark:border-ink-800"}`}>
            <input type="radio" name="quotaPolicy" value="shared" checked={selectedPolicy === "shared"} onChange={() => setSelectedPolicy("shared")} className="mt-0.5" />
            <span>
              <span className="font-bold">Pool partagé (par défaut)</span>
              <span className="block text-xs text-ink-500 dark:text-ink-400">
                Les quotas IA du forfait sont communs. Le premier qui en a besoin les utilise. Les 100 pages de scan
                restent individuelles.
              </span>
            </span>
          </label>
          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${selectedPolicy === "per_member" ? "border-brand-500 bg-brand-50/60 dark:bg-brand-950/20" : "border-ink-200 dark:border-ink-800"}`}>
            <input type="radio" name="quotaPolicy" value="per_member" checked={selectedPolicy === "per_member"} onChange={() => setSelectedPolicy("per_member")} className="mt-0.5" />
            <span>
              <span className="font-bold">Répartition égale par membre</span>
              <span className="block text-xs text-ink-500 dark:text-ink-400">
                Les quotas du groupe sont divisés à parts égales. Un membre ne peut pas consommer la part d'un autre.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Limite de stockage par membre (facultatif)</legend>
        <p className="hint mb-2">Laissez vide pour ne pas limiter. Le pool de 50 Go reste partagé.</p>
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.userId} className="flex items-center gap-2">
              <input type="hidden" name="memberId" value={member.userId} />
              <span className="min-w-0 flex-1 truncate text-sm">
                {member.name ?? member.email}
                {member.role === "admin" && <span className="ml-1 text-xs text-ink-400">(admin)</span>}
              </span>
              <input
                name={`limit_${member.userId}`}
                className="input w-24"
                type="number"
                min={0.1}
                max={50}
                step={0.1}
                defaultValue={member.limitGb ?? ""}
                placeholder="— Go"
                aria-label={`Limite de stockage pour ${member.name ?? member.email}, en Go`}
              />
              <span className="text-xs text-ink-500 dark:text-ink-400">Go</span>
            </div>
          ))}
        </div>
      </fieldset>

      {state.error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{state.error}</p>}
      {state.ok && state.message && <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{state.message}</p>}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Settings2 className="h-4 w-4" aria-hidden="true" />}
        Enregistrer les réglages
      </button>
    </form>
  );
}
