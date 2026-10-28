import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Check,
  CreditCard,
  FileCheck2,
  FolderLock,
  Languages,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users
} from "lucide-react";
import { Logo, TrustLine } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge, Card } from "@/components/ui";
import { PLAN_LIST, formatPrice } from "@/lib/quota/plans";
import { allowSimulation } from "@/lib/env";

const features = [
  {
    icon: ScanLine,
    title: "Scanner en un geste",
    text: "Photo ou import, recadrage, amélioration, plusieurs pages, PDF prêt à envoyer."
  },
  {
    icon: FolderLock,
    title: "Un coffre-fort clair",
    text: "Vos documents rangés par domaine, chiffrés, avec échéances et recherche."
  },
  {
    icon: Sparkles,
    title: "Comprendre sans jargon",
    text: "De quoi s'agit-il ? Que faire ? Avant quelle date ? En français simple."
  },
  {
    icon: ShieldAlert,
    title: "Repérer les arnaques",
    text: "Liens suspects, urgence artificielle, faux frais : Klerio vous alerte avant de payer."
  },
  {
    icon: BellRing,
    title: "Ne plus rien oublier",
    text: "Des rappels bienveillants, à la bonne date, par notification ou e-mail."
  },
  {
    icon: Users,
    title: "Penser à toute la famille",
    text: "Cinq espaces privés, un stockage partagé, des rappels familiaux."
  }
];

export default function LandingPage() {
  const showDemo = allowSimulation;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-[#f6f4ee]/90 backdrop-blur dark:border-ink-800 dark:bg-ink-950/85">
        <div className="mx-auto flex min-h-[68px] w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="Klerio, accueil">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-ink-600 md:flex dark:text-ink-300" aria-label="Navigation du site">
            <a href="#fonctionnalites" className="hover:text-brand-700 dark:hover:text-brand-300">
              Fonctionnalités
            </a>
            <a href="#forfaits" className="hover:text-brand-700 dark:hover:text-brand-300">
              Forfaits
            </a>
            <a href="#securite" className="hover:text-brand-700 dark:hover:text-brand-300">
              Sécurité
            </a>
            <Link href="/login" className="link whitespace-nowrap">
              Se connecter
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/register" className="btn-primary">
              Commencer
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pb-24 lg:pt-20">
          <div>
            <Badge tone="brand" className="mb-5">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Gratuit pour commencer · sans carte bancaire
            </Badge>
            <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Votre administratif,
              <span className="block text-brand-700 dark:text-brand-300">sans stress.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-600 dark:text-ink-300">
              Klerio scanne, range et explique vos documents. Il vous dit quoi faire, avant quelle date, et vous
              prévient quand quelque chose ressemble à une arnaque.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="btn-primary px-6 text-base">
                Créer mon compte gratuit
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/login" className="btn-secondary px-6 text-base">
                {showDemo ? "Voir la démo" : "Se connecter"}
              </Link>
            </div>
            {showDemo && (
              <p className="mt-4 text-sm text-ink-500 dark:text-ink-400">
                Démo : <strong>demo@klerio.fr</strong> · mot de passe <strong>Klerio2026!</strong>
              </p>
            )}
            <TrustLine className="mt-6" />
          </div>

          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-brand-200/60 via-transparent to-accent-200/40 blur-2xl dark:from-brand-900/40 dark:to-accent-900/20" />
            <Card className="relative overflow-hidden p-0">
              <div className="border-b border-ink-100 bg-brand-50/70 px-5 py-4 dark:border-ink-800 dark:bg-brand-950/30">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-800 dark:text-brand-200">Aujourd'hui</p>
                <p className="mt-1 text-lg font-bold">3 choses, pas plus.</p>
              </div>
              <div className="space-y-3 p-4">
                <div className="rounded-xl border border-accent-200 bg-accent-50/70 p-3.5 dark:border-accent-900 dark:bg-accent-950/30">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-accent-800 dark:text-accent-200">À faire avant le 15 décembre</span>
                    <span className="chip">3 min</span>
                  </div>
                  <p className="mt-1.5 font-semibold">Vérifier la situation de mon logement</p>
                  <p className="mt-1 text-xs text-ink-600 dark:text-ink-300">
                    Courrier des impôts compris. Aucun paiement demandé.
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-brand-700 dark:text-brand-300">
                    <Check className="h-4 w-4" aria-hidden="true" /> Explication prête
                  </div>
                </div>
                <div className="rounded-xl border border-ink-200 p-3.5 dark:border-ink-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-ink-500 dark:text-ink-400">Coffre-fort</span>
                    <span className="chip">10 Go</span>
                  </div>
                  <p className="mt-1.5 font-semibold">Attestation de salaire septembre</p>
                  <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Classée dans Travail · chiffrée</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Aucun signal d'arnaque détecté</p>
                      <p className="mt-0.5 text-xs text-emerald-800/80 dark:text-emerald-200/80">
                        Vérifié sur les domaines officiels. Vous gardez la main.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>

        <section id="fonctionnalites" className="border-y border-ink-200/70 bg-white/45 py-16 dark:border-ink-800 dark:bg-ink-900/30">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <p className="section-title">Tout au même endroit</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
              Moins de paperasse. Plus de clarté.
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.title} className="card p-5">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-800 dark:bg-brand-900/50 dark:text-brand-200">
                    <feature.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-bold">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-600 dark:text-ink-300">{feature.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <Badge tone="danger" className="mb-4">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              Arnaques administratives
            </Badge>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              « Urgent, payez maintenant. »
              <span className="block text-ink-500 dark:text-ink-400">On vérifie avant vous.</span>
            </h2>
            <p className="mt-4 text-ink-600 dark:text-ink-300">
              Klerio ne génère jamais de lien au hasard. Il compare les adresses à une liste de sites officiels
              vérifiés, repère les demandes inhabituelles et vous recommande de ne pas payer en cas de doute.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {[
                "Lien hors domaine officiel = alerte immédiate",
                "Demande de mot de passe ou de code = alerte immédiate",
                "Aucun paiement ne part sans votre validation",
                "Klerio ne remplace pas un avocat ou un notaire"
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
            <div className="flex items-center justify-between gap-3">
              <span className="badge bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-100">Risque élevé</span>
              <span className="text-xs font-semibold text-red-700 dark:text-red-300">Confiance : 92 %</span>
            </div>
            <h3 className="mt-3 text-lg font-bold">Faux avis d'amende</h3>
            <p className="mt-2 text-sm text-ink-700 dark:text-ink-200">
              « Dernier avertissement : réglez 49 € sous 24 h via ce lien. » Le message contient un lien hors
              service-public.fr et une urgence artificielle.
            </p>
            <div className="mt-4 rounded-xl bg-white p-3 text-sm font-semibold text-red-800 dark:bg-ink-950 dark:text-red-200">
              Recommandation : ne payez pas, ne cliquez pas. Vérifiez sur service-public.fr ou
              cybermalveillance.gouv.fr.
            </div>
            <p className="mt-3 text-xs text-ink-500 dark:text-ink-400">
              Exemple illustratif. L'analyse réelle affiche toujours les signaux détectés et leur niveau de confiance.
            </p>
          </Card>
        </section>

        <section id="forfaits" className="border-y border-ink-200/70 bg-white/45 py-16 dark:border-ink-800 dark:bg-ink-900/30">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="section-title">Des règles claires</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Vous savez toujours ce que vous consommez.</h2>
                <p className="mt-2 max-w-2xl text-sm text-ink-600 dark:text-ink-300">
                  Deux compteurs séparés : les quotas inclus et les crédits. Aucun prélèvement automatique silencieux.
                </p>
              </div>
              <Badge tone="success">
                <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
                Prix TTC · résiliable en ligne
              </Badge>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {PLAN_LIST.map((plan) => {
                const highlight = plan.id === "pro";
                return (
                  <div
                    key={plan.id}
                    className={`relative flex flex-col rounded-2xl border p-5 ${
                      highlight
                        ? "border-brand-600 bg-white shadow-float dark:border-brand-400 dark:bg-ink-900"
                        : "border-ink-200 bg-white/70 dark:border-ink-800 dark:bg-ink-900/60"
                    }`}
                  >
                    {highlight && (
                      <span className="absolute -top-3 left-5 rounded-full bg-brand-700 px-3 py-1 text-xs font-bold text-white dark:bg-brand-400 dark:text-ink-950">
                        Le plus choisi
                      </span>
                    )}
                    <p className="text-lg font-black">{plan.name}</p>
                    <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{plan.tagline}</p>
                    <p className="mt-4 text-3xl font-black">
                      {formatPrice(plan.priceMonthlyCents)}
                      <span className="text-sm font-semibold text-ink-500 dark:text-ink-400"> / mois TTC</span>
                    </p>
                    {plan.priceYearlyCents > 0 && (
                      <p className="text-xs text-ink-500 dark:text-ink-400">
                        ou {formatPrice(plan.priceYearlyCents)} / an TTC
                      </p>
                    )}
                    <ul className="mt-5 flex-1 space-y-2 text-sm">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/register"
                      className={`mt-6 ${highlight ? "btn-primary" : "btn-secondary"} w-full`}
                    >
                      {plan.id === "standard" ? "Commencer gratuitement" : `Choisir ${plan.name}`}
                    </Link>
                  </div>
                );
              })}
            </div>
            <p className="mt-5 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
              Les 20 pages de scan du forfait Standard sont cumulatives à vie et ne se réinitialisent jamais.
              Les quotas mensuels repartent à la date anniversaire de l'abonnement ; les quotas hebdomadaires le lundi à
              00h00 (Europe/Paris). Crédits achetables de 2 € à 20 €, sans reconduction.
            </p>
          </div>
        </section>

        <section id="securite" className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-16 sm:px-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <p className="section-title">Sécurité et vie privée</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Vos documents restent vos documents.</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                { icon: ShieldCheck, title: "Chiffrement renforcé", text: "Chaque fichier a sa propre clé, chiffrée par une clé maître. TLS en transit." },
                { icon: FolderLock, title: "Hébergement UE", text: "Les fichiers et la base sont hébergés dans l'Union européenne." },
                { icon: Languages, title: "Accessible", text: "Grands boutons, contraste AA, mode sombre, langage simple et traduction gratuite." },
                { icon: FileCheck2, title: "Vous gardez la main", text: "Aucune suppression automatique, aucun envoi sans validation, export à tout moment." }
              ].map((item) => (
                <div key={item.title} className="card flex gap-3 p-4">
                  <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden="true" />
                  <div>
                    <p className="font-bold">{item.title}</p>
                    <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Card className="flex flex-col justify-center bg-brand-900 text-brand-50 dark:bg-brand-950">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-300">
              {showDemo ? "Démonstration" : "Votre espace"}
            </p>
            <h3 className="mt-2 text-2xl font-black">
              {showDemo ? "Testez sans créer de compte." : "Un compte, un espace privé."}
            </h3>
            <p className="mt-2 text-sm text-brand-100/90">
              {showDemo
                ? "Trois profils sont prêts : Standard, Pro et Famille. Aucune donnée réelle n'est utilisée."
                : "Créez votre compte en quelques secondes. 20 pages de scan offertes à vie, sans carte bancaire."}
            </p>
            {showDemo ? (
              <div className="mt-4 space-y-2 rounded-xl bg-white/10 p-3 text-sm">
                <p><strong>demo@klerio.fr</strong> — Standard</p>
                <p><strong>pro@klerio.fr</strong> — Pro + crédits</p>
                <p><strong>famille@klerio.fr</strong> — Famille</p>
                <p className="text-brand-200">Mot de passe : Klerio2026!</p>
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-white/10 p-3 text-sm text-brand-100/90">
                Inscription gratuite. Vos documents sont chiffrés et restent privés.
              </div>
            )}
            <Link href={showDemo ? "/login" : "/register"} className="btn-accent mt-5 w-full">
              {showDemo ? "Ouvrir la démo" : "Créer mon compte"}
            </Link>
          </Card>
        </section>

        <section className="border-t border-ink-200/70 py-14 dark:border-ink-800">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 text-center sm:px-6">
            <h2 className="text-3xl font-black tracking-tight">Un document à comprendre ?</h2>
            <p className="max-w-xl text-ink-600 dark:text-ink-300">
              Prenez-le en photo. Klerio vous explique la suite en quelques secondes, sans jargon.
            </p>
            <Link href="/register" className="btn-primary px-6 text-base">
              Commencer gratuitement
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <TrustLine className="mt-2" />
          </div>
        </section>
      </main>

      <footer className="border-t border-ink-200/70 bg-white/50 py-8 dark:border-ink-800 dark:bg-ink-900/30">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 text-sm text-ink-500 sm:px-6 md:flex-row md:items-center md:justify-between dark:text-ink-400">
          <div className="flex items-center gap-3">
            <Logo compact />
            <span>© {new Date().getFullYear()} Klerio — démonstration produit.</span>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Informations légales">
            <Link href="/legal/mentions" className="hover:text-brand-700 dark:hover:text-brand-300">Mentions légales</Link>
            <Link href="/legal/cgu" className="hover:text-brand-700 dark:hover:text-brand-300">CGU</Link>
            <Link href="/legal/cgv" className="hover:text-brand-700 dark:hover:text-brand-300">CGV</Link>
            <Link href="/legal/confidentialite" className="hover:text-brand-700 dark:hover:text-brand-300">Confidentialité</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
