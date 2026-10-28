"use client";

import { useActionState, useState } from "react";
import { BellRing, Loader2, Plus } from "lucide-react";
import { createReminderAction, type ReminderState } from "@/app/actions/reminders";
import { Badge } from "@/components/ui";

const initial: ReminderState = { ok: false };

export function ReminderForm({
  planId,
  hasFamily,
  initialTitle,
  documentId,
  defaultDate
}: {
  planId: string;
  hasFamily: boolean;
  initialTitle?: string;
  documentId?: string;
  defaultDate?: string;
}) {
  const [state, action, pending] = useActionState(createReminderAction, initial);
  const [recurrence, setRecurrence] = useState("none");
  const advanced = planId !== "standard";

  return (
    <form action={action} className="space-y-4">
      {documentId && <input type="hidden" name="documentId" value={documentId} />}
      <div>
        <label htmlFor="title" className="label">Titre du rappel</label>
        <input id="title" name="title" className="input" defaultValue={initialTitle} placeholder="Ex. Envoyer le justificatif à la CAF" required maxLength={160} />
      </div>
      <div>
        <label htmlFor="dueAt" className="label">Date d'échéance</label>
        <input id="dueAt" name="dueAt" type="date" className="input" defaultValue={defaultDate} required />
      </div>
      <div>
        <label htmlFor="notes" className="label">Note <span className="font-normal text-ink-400">(facultatif)</span></label>
        <textarea id="notes" name="notes" className="textarea min-h-[80px]" placeholder="Ce qu'il faut faire, les pièces à préparer…" />
      </div>

      <fieldset>
        <legend className="label">Me prévenir par</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 dark:border-ink-800">
            <input type="checkbox" name="channels" value="in_app" defaultChecked /> Dans l'application
          </label>
          <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${advanced ? "border-ink-200 dark:border-ink-800" : "border-ink-100 opacity-60 dark:border-ink-800"}`}>
            <input type="checkbox" name="channels" value="email" disabled={!advanced} /> Par e-mail
          </label>
          <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${advanced ? "border-ink-200 dark:border-ink-800" : "border-ink-100 opacity-60 dark:border-ink-800"}`}>
            <input type="checkbox" name="channels" value="push" disabled={!advanced} /> Notification push
          </label>
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="recurrence" className="label">Répétition</label>
          <select id="recurrence" name="recurrence" className="select" value={recurrence} onChange={(e) => setRecurrence(e.target.value)} disabled={!advanced}>
            <option value="none">Une seule fois</option>
            <option value="weekly">Chaque semaine</option>
            <option value="monthly">Chaque mois</option>
            <option value="yearly">Chaque année</option>
          </select>
          {!advanced && <p className="hint mt-1">Les rappels avancés sont réservés à Pro.</p>}
        </div>
        <div>
          <label htmlFor="advanceDays" className="label">Alertes anticipées</label>
          <input
            id="advanceDays"
            name="advanceDays"
            className="input"
            placeholder="7, 1"
            disabled={!advanced}
            aria-describedby="advance-hint"
          />
          <p id="advance-hint" className="hint mt-1">Jours avant l'échéance, séparés par des virgules (ex. 7, 1).</p>
        </div>
      </div>

      {hasFamily && (
        <label className="flex items-start gap-2.5 rounded-xl border border-ink-200 p-3 text-sm dark:border-ink-800">
          <input type="checkbox" name="visibility" value="family" className="mt-0.5" />
          <span>
            <strong>Rappel familial.</strong> Tous les membres du groupe le verront. Les documents liés restent privés
            s'ils ne sont pas partagés.
          </span>
        </label>
      )}

      {!advanced && (
        <p className="rounded-xl bg-ink-50 p-3 text-xs text-ink-600 dark:bg-ink-900 dark:text-ink-300">
          <Badge tone="brand" className="mr-1">Standard</Badge>
          Rappels de base inclus. Passez à Pro pour les répétitions, les alertes multiples et les notifications par
          e-mail ou push.
        </p>
      )}

      {state.error && <p className="text-sm font-semibold text-red-600 dark:text-red-400" role="alert">{state.error}</p>}
      {state.ok && state.message && <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{state.message}</p>}

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
        {pending ? "Création…" : "Créer le rappel"}
      </button>
      <p className="hint flex items-center gap-1.5">
        <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
        Les notifications in-app sont immédiates. En développement, les e-mails sont écrits dans la console du serveur.
      </p>
    </form>
  );
}
