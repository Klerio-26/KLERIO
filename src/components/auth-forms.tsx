"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AlertCircle, ArrowRight, Loader2, LockKeyhole } from "lucide-react";
import { loginAction, registerAction, type AuthState } from "@/app/actions/auth";

const initial: AuthState = { ok: false };

function ErrorBox({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100" role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

export function LoginForm({ next, showDemo = false }: { next?: string; showDemo?: boolean }) {
  const [state, action, pending] = useActionState(loginAction, initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label className="label" htmlFor="email">Adresse e-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@exemple.fr"
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="password">Mot de passe</label>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {state.needs2fa && (
        <div>
          <label className="label" htmlFor="code">Code de vérification (2FA)</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="input" placeholder="123456" />
          <p className="hint mt-1">Ouvrez votre application d'authentification et saisissez le code à 6 chiffres.</p>
        </div>
      )}
      <ErrorBox message={state.error} />
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LockKeyhole className="h-4 w-4" aria-hidden="true" />}
        {pending ? "Connexion…" : "Me connecter"}
      </button>
      {showDemo && (
        <button
          type="button"
          className="btn-ghost w-full text-sm"
          onClick={() => {
            setEmail("pro@klerio.fr");
            setPassword("Klerio2026!");
          }}
        >
          Remplir avec le compte de démonstration
        </button>
      )}
      <p className="text-center text-sm text-ink-500 dark:text-ink-400">
        Pas encore de compte ?{" "}
        <Link href="/register" className="link">Créer un compte gratuit</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initial);
  const [password, setPassword] = useState("");

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="name">Votre prénom et nom <span className="font-normal text-ink-400">(facultatif)</span></label>
        <input id="name" name="name" autoComplete="name" className="input" placeholder="Nadia Lefèvre" />
      </div>
      <div>
        <label className="label" htmlFor="email">Adresse e-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" placeholder="vous@exemple.fr" />
      </div>
      <div>
        <label className="label" htmlFor="password">Mot de passe</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="hint mt-1">Au moins 10 caractères, avec une majuscule, une minuscule et un chiffre.</p>
        <div className="mt-2 flex gap-1" aria-hidden="true">
          {[10, 12, 14, 16].map((threshold) => (
            <span
              key={threshold}
              className={`h-1.5 flex-1 rounded-full ${password.length >= threshold ? "bg-brand-500" : "bg-ink-200 dark:bg-ink-800"}`}
            />
          ))}
        </div>
      </div>
      <label className="flex items-start gap-2.5 rounded-xl border border-ink-200 p-3 text-sm dark:border-ink-800">
        <input type="checkbox" name="accept" required className="mt-0.5" />
        <span>
          J'accepte les{" "}
          <Link href="/legal/cgu" className="link">conditions d'utilisation</Link> et la{" "}
          <Link href="/legal/confidentialite" className="link">politique de confidentialité</Link>.
        </span>
      </label>
      <ErrorBox message={state.error} />
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
        {pending ? "Création…" : "Créer mon compte"}
      </button>
      <p className="text-center text-sm text-ink-500 dark:text-ink-400">
        Déjà inscrit ? <Link href="/login" className="link">Se connecter</Link>
      </p>
    </form>
  );
}
