import Link from "next/link";
import { Logo, TrustLine } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Check } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">
      <div className="flex flex-col px-4 py-5 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Klerio, accueil">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
        <p className="mx-auto w-full max-w-md text-xs leading-relaxed text-ink-500 dark:text-ink-400">
          Klerio est une démonstration produit. Les pages légales sont des brouillons à faire valider par un juriste.
        </p>
      </div>

      <aside className="relative hidden overflow-hidden bg-brand-900 p-12 text-brand-50 lg:flex lg:flex-col lg:justify-center dark:bg-brand-950">
        <div className="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_20%_15%,rgba(174,219,211,.35),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(251,95,18,.25),transparent_45%)]" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-300">La paperasse, en clair</p>
          <h2 className="mt-3 max-w-lg text-4xl font-black leading-tight">
            Vous n'avez pas à tout comprendre seul.
          </h2>
          <p className="mt-4 max-w-md text-brand-100/90">
            Klerio vous accompagne pas à pas : comprendre un courrier, repérer une arnaque, préparer un formulaire,
            ne pas oublier une échéance.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              "Vos documents chiffrés, hébergés en UE",
              "Aucune donnée utilisée pour entraîner l'IA",
              "Aucun envoi sans votre validation",
              "Une interface simple, contrastée, accessible"
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-brand-500/40">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <TrustLine className="mt-10 text-brand-200" />
        </div>
      </aside>
    </div>
  );
}
