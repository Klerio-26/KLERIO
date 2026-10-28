"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Check, Copy, KeyRound, Loader2, LockKeyhole, Save, ShieldCheck, Trash2 } from "lucide-react";
import {
  changePasswordAction,
  confirm2faAction,
  deleteAccountAction,
  disable2faAction,
  start2faAction,
  updateProfileAction,
  type AccountState
} from "@/app/actions/account";
import { Badge, Card } from "@/components/ui";

const initial: AccountState = { ok: false };

function Feedback({ state }: { state: AccountState }) {
  if (state.error) return <p className="text-sm font-semibold text-red-600 dark:text-red-400" role="alert">{state.error}</p>;
  if (state.ok && state.message) return <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{state.message}</p>;
  return null;
}

export function ProfileForm({ name, locale }: { name: string; locale: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, initial);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="profile-name" className="label">Prénom et nom</label>
        <input id="profile-name" name="name" className="input" defaultValue={name} maxLength={120} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="locale" className="label">Langue de l'interface</label>
          <select id="locale" name="locale" className="select" defaultValue={locale}>
            <option value="fr">Français</option>
            <option value="en">English (bientôt)</option>
          </select>
        </div>
        <div>
          <label htmlFor="timezone" className="label">Fuseau horaire</label>
          <select id="timezone" name="timezone" className="select" defaultValue="Europe/Paris">
            <option value="Europe/Paris">Europe/Paris</option>
          </select>
        </div>
      </div>
      <Feedback state={state} />
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
        Enregistrer
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initial);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="current" className="label">Mot de passe actuel</label>
        <input id="current" name="current" type="password" autoComplete="current-password" className="input" required />
      </div>
      <div>
        <label htmlFor="next" className="label">Nouveau mot de passe</label>
        <input id="next" name="next" type="password" autoComplete="new-password" minLength={10} className="input" required />
        <p className="hint mt-1">10 caractères minimum, avec majuscule, minuscule et chiffre. Les autres sessions seront déconnectées.</p>
      </div>
      <Feedback state={state} />
      <button type="submit" className="btn-secondary" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LockKeyhole className="h-4 w-4" aria-hidden="true" />}
        Modifier le mot de passe
      </button>
    </form>
  );
}

export function TwoFactorPanel({ enabled }: { enabled: boolean }) {
  const [startState, startAction, startPending] = useActionState(start2faAction, initial);
  const [confirmState, confirmAction, confirmPending] = useActionState(confirm2faAction, initial);
  const [disableState, disableAction, disablePending] = useActionState(disable2faAction, initial);
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Ajoutez un code à 6 chiffres à chaque connexion. Compatible avec toutes les applications TOTP.
        </p>
        <Badge tone={enabled ? "success" : "neutral"}>{enabled ? "Activée" : "Désactivée"}</Badge>
      </div>

      {!enabled && (
        <>
          <form action={startAction}>
            <button type="submit" className="btn-secondary" disabled={startPending}>
              {startPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
              Générer une clé
            </button>
          </form>
          {startState.secret && (
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-xs dark:border-brand-800 dark:bg-brand-950/30">
              <p className="font-bold">1. Ajoutez cette clé dans votre application</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="break-all rounded bg-white px-2 py-1 font-mono text-[0.7rem] dark:bg-ink-950">{startState.secret}</code>
                <button
                  type="button"
                  className="btn-ghost h-8 w-8 shrink-0 p-0"
                  onClick={async () => {
                    await navigator.clipboard?.writeText(startState.secret ?? "");
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  aria-label="Copier la clé 2FA"
                >
                  {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                </button>
              </div>
              {startState.otpauth && (
                <p className="mt-2 break-all text-[0.68rem] text-ink-500 dark:text-ink-400">
                  URI : {startState.otpauth}
                </p>
              )}
              <form action={confirmAction} className="mt-3 flex flex-wrap items-end gap-2">
                <div className="flex-1">
                  <label htmlFor="code" className="label">2. Code à 6 chiffres</label>
                  <input id="code" name="code" inputMode="numeric" maxLength={6} className="input" required placeholder="123456" />
                </div>
                <button type="submit" className="btn-primary" disabled={confirmPending}>
                  {confirmPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
                  Activer
                </button>
              </form>
              <Feedback state={confirmState} />
            </div>
          )}
          <Feedback state={startState} />
        </>
      )}

      {enabled && (
        <form action={disableAction} className="space-y-2">
          <label htmlFor="2fa-password" className="label">Mot de passe pour désactiver</label>
          <div className="flex flex-wrap gap-2">
            <input id="2fa-password" name="password" type="password" className="input max-w-xs" required />
            <button type="submit" className="btn-ghost" disabled={disablePending}>
              {disablePending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LockKeyhole className="h-4 w-4" aria-hidden="true" />}
              Désactiver
            </button>
          </div>
          <Feedback state={disableState} />
        </form>
      )}
    </div>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccountAction, initial);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="btn-danger text-xs" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" aria-hidden="true" /> Supprimer mon compte
      </button>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
      <p className="flex items-start gap-2 text-sm font-semibold text-red-900 dark:text-red-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        Cette action déconnecte toutes les sessions et place vos documents en corbeille. La suppression définitive
        intervient après 30 jours, sauf demande contraire.
      </p>
      <div>
        <label htmlFor="delete-password" className="label">Mot de passe</label>
        <input id="delete-password" name="password" type="password" className="input" required autoComplete="current-password" />
      </div>
      <div>
        <label htmlFor="confirmation" className="label">Tapez SUPPRIMER</label>
        <input id="confirmation" name="confirmation" className="input" required placeholder="SUPPRIMER" />
      </div>
      <Feedback state={state} />
      <div className="flex gap-2">
        <button type="submit" className="btn-danger" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
          Confirmer la suppression
        </button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
      </div>
    </form>
  );
}
