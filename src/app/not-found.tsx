import Link from "next/link";
import { Logo } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md text-center">
        <Logo />
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-brand-700 dark:text-brand-300">Erreur 404</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Cette page n'existe pas.</h1>
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
          Le document a peut-être été supprimé, ou le lien n'est pas valide.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/app" className="btn-primary">Retour à mon espace</Link>
          <Link href="/" className="btn-secondary">Accueil</Link>
        </div>
      </div>
    </div>
  );
}
