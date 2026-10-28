import type { Metadata } from "next";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { getOfficialLinks } from "@/lib/official-links";
import { Card } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Liens officiels" };
export const dynamic = "force-dynamic";

export default async function OfficialLinksPage() {
  const links = await getOfficialLinks();
  const groups = new Map<string, typeof links>();
  for (const link of links) {
    const list = groups.get(link.category) ?? [];
    list.push(link);
    groups.set(link.category, list);
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="section-title">Base vérifiée</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Les sites officiels, sans détour.</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-600 dark:text-ink-300">
          Klerio ne génère jamais de lien. Cette liste est contrôlée et mise à jour. En cas de doute, tapez l'adresse
          vous-même dans votre navigateur.
        </p>
      </header>

      <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4 text-sm text-brand-900 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-100">
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Un lien reçu par SMS ou e-mail n'est jamais prioritaire sur cette liste. Ne communiquez jamais vos mots de
          passe, codes SMS ou coordonnées bancaires complètes.
        </p>
      </div>

      <div className="space-y-4">
        {Array.from(groups.entries()).map(([category, items]) => (
          <Card key={category}>
            <h2 className="font-bold">{category}</h2>
            <ul className="mt-3 divide-y divide-ink-100 dark:divide-ink-800">
              {items.map((link) => (
                <li key={link.id} className="py-2.5">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="group flex items-start justify-between gap-3"
                  >
                    <span>
                      <span className="block text-sm font-semibold group-hover:text-brand-700 dark:group-hover:text-brand-300">
                        {link.label}
                      </span>
                      <span className="block text-xs text-ink-500 dark:text-ink-400">{link.description}</span>
                      <span className="mt-0.5 block text-[0.68rem] text-ink-400">
                        {link.domain} · vérifié le {formatDate(link.verifiedAt)}
                      </span>
                    </span>
                    <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
