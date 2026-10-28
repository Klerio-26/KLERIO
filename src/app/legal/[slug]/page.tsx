import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileWarning } from "lucide-react";
import { Logo } from "@/components/brand";
import { Card } from "@/components/ui";

export const dynamic = "force-static";

interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: Array<{ heading: string; paragraphs: string[] }>;
}

const DOCS: Record<string, LegalDoc> = {
  mentions: {
    title: "Mentions légales",
    updated: "1 octobre 2026",
    intro:
      "Brouillon à faire valider par un juriste. Les informations d'identification de l'éditeur doivent être complétées avant toute mise en ligne publique.",
    sections: [
      {
        heading: "Éditeur",
        paragraphs: [
          "Klerio est un service de démonstration édité par [RAISON SOCIALE], [FORME JURIDIQUE] au capital de [MONTANT] €, immatriculée au RCS de [VILLE] sous le numéro [SIREN], dont le siège social est situé [ADRESSE].",
          "Responsable de la publication : [NOM, PRÉNOM]. Contact : [ADRESSE E-MAIL]. Numéro de TVA intracommunautaire : [TVA]."
        ]
      },
      {
        heading: "Hébergement",
        paragraphs: [
          "Les serveurs applicatifs et la base de données sont hébergés dans l'Union européenne chez [HÉBERGEUR], [ADRESSE], téléphone [TÉLÉPHONE].",
          "Le stockage des documents est assuré par un service objet compatible S3 situé dans l'Union européenne. Les sauvegardes sont chiffrées."
        ]
      },
      {
        heading: "Propriété intellectuelle",
        paragraphs: [
          "La marque Klerio, l'interface, les textes et les éléments graphiques sont protégés. Toute reproduction non autorisée est interdite.",
          "Les documents déposés par les utilisateurs restent leur propriété. Klerio ne les utilise que pour rendre le service demandé."
        ]
      },
      {
        heading: "Signalement",
        paragraphs: [
          "Pour signaler un contenu illicite ou un dysfonctionnement : [ADRESSE E-MAIL DÉDIÉE]. Un accusé de réception est envoyé sous 72 heures ouvrées."
        ]
      }
    ]
  },
  cgu: {
    title: "Conditions générales d'utilisation",
    updated: "1 octobre 2026",
    intro:
      "Brouillon à faire valider par un juriste. Les CGU encadrent l'usage de Klerio par les particuliers. Elles ne constituent pas un conseil juridique.",
    sections: [
      {
        heading: "Objet",
        paragraphs: [
          "Klerio aide les particuliers à scanner, classer, comprendre et préparer leurs démarches administratives. Le service ne se substitue pas à un avocat, un notaire, un comptable ou un organisme public.",
          "Les analyses et courriers générés sont des aides à la compréhension. L'utilisateur doit vérifier les informations et reste responsable de ses démarches."
        ]
      },
      {
        heading: "Compte et sécurité",
        paragraphs: [
          "L'utilisateur fournit une adresse e-mail valide et un mot de passe robuste. Il peut activer la double authentification. Il est responsable de la confidentialité de ses identifiants.",
          "Un compte famille peut compter jusqu'à cinq personnes. L'administrateur gère les invitations et les réglages, mais n'accède pas aux documents privés des autres membres."
        ]
      },
      {
        heading: "Usage acceptable",
        paragraphs: [
          "Il est interdit de scanner ou stocker des contenus illicites, d'utiliser le service pour usurper l'identité d'un tiers, de contourner les quotas ou de tenter d'accéder aux documents d'un autre utilisateur.",
          "Klerio peut suspendre un compte en cas d'abus grave, après information lorsque la loi le permet."
        ]
      },
      {
        heading: "Intelligence artificielle",
        paragraphs: [
          "Certaines fonctions utilisent un modèle de langage. Les résultats peuvent comporter des erreurs. L'utilisateur doit conserver les documents originaux et vérifier les échéances.",
          "Klerio ne soumet jamais un document à une administration sans validation explicite. Le remplissage automatique produit un récapitulatif que l'utilisateur doit relire."
        ]
      },
      {
        heading: "Disponibilité et responsabilité",
        paragraphs: [
          "Le service est fourni « en l'état ». Klerio met en œuvre des moyens raisonnables pour assurer sa disponibilité et la sécurité des données, sans garantie d'absence d'interruption.",
          "La responsabilité de Klerio ne peut être engagée pour une décision prise sur la base d'une analyse, ni pour un dommage résultant d'un usage contraire aux présentes conditions."
        ]
      },
      {
        heading: "Résiliation",
        paragraphs: [
          "L'utilisateur peut supprimer son compte à tout moment depuis son espace. Les documents sont placés en corbeille pendant 30 jours avant suppression définitive, sauf obligation légale de conservation."
        ]
      }
    ]
  },
  cgv: {
    title: "Conditions générales de vente",
    updated: "1 octobre 2026",
    intro:
      "Brouillon à faire valider par un juriste. Les prix sont indiqués en euros TTC, TVA française à 20 % incluse. Le marché initial est la France.",
    sections: [
      {
        heading: "Forfaits et prix",
        paragraphs: [
          "Standard : 0 €. Pro : 7,99 €/mois ou 79,90 €/an TTC. Pro Famille : 12,99 €/mois ou 129,90 €/an TTC. Les prix peuvent évoluer ; toute modification est notifiée avant application.",
          "Les crédits sont achetés par montant libre, entre 2 € et 20 € par achat. Ils sont distincts des quotas inclus, ne se reconduisent pas automatiquement et n'expirent pas tant que le compte est actif."
        ]
      },
      {
        heading: "Quotas",
        paragraphs: [
          "Les 20 pages de scan du forfait Standard sont cumulatives à vie et ne se réinitialisent jamais. Les quotas mensuels repartent à la date anniversaire de l'abonnement ; les quotas hebdomadaires le lundi à 00h00 (Europe/Paris).",
          "Un quota atteint ne déclenche aucun paiement automatique. L'utilisateur choisit explicitement d'attendre, d'utiliser des crédits ou de changer de forfait."
        ]
      },
      {
        heading: "Paiement et facturation",
        paragraphs: [
          "Le paiement est traité par Stripe (cartes, Apple Pay, Google Pay). Klerio ne stocke pas les données bancaires. Une facture est disponible dans l'espace client.",
          "En cas d'échec de paiement, l'abonnement peut être suspendu après relance. Les documents restent accessibles en lecture et exportables."
        ]
      },
      {
        heading: "Droit de rétractation",
        paragraphs: [
          "Pour un service numérique fourni immédiatement, l'utilisateur peut demander à renoncer à son droit de rétractation lors de la souscription. À défaut, le droit de rétractation de 14 jours s'applique conformément au Code de la consommation.",
          "Les crédits non utilisés peuvent être remboursés dans les 14 jours suivant l'achat, sauf renoncement exprès."
        ]
      },
      {
        heading: "Changement de forfait et résiliation",
        paragraphs: [
          "Un upgrade prend effet immédiatement, avec prorata calculé par Stripe. Un downgrade prend effet à la prochaine échéance. En cas de stockage supérieur à la nouvelle limite, aucun document n'est supprimé : le coffre passe en lecture seule avec 60 jours de grâce.",
          "La résiliation se fait en ligne, en quelques clics. Elle prend effet à la fin de la période payée. Aucun frais de résiliation n'est appliqué."
        ]
      },
      {
        heading: "Réclamations et médiation",
        paragraphs: [
          "Réclamation : [ADRESSE E-MAIL]. En cas de litige non résolu, l'utilisateur peut recourir gratuitement à un médiateur de la consommation : [COORDONNÉES DU MÉDIATEUR].",
          "Droit applicable : droit français. Juridiction compétente : [TRIBUNAL]."
        ]
      }
    ]
  },
  confidentialite: {
    title: "Politique de confidentialité",
    updated: "1 octobre 2026",
    intro:
      "Brouillon à faire valider par un juriste et à compléter par une analyse d'impact (AIPD). Klerio traite des documents administratifs pouvant contenir des données sensibles.",
    sections: [
      {
        heading: "Responsable du traitement",
        paragraphs: [
          "[RAISON SOCIALE], [ADRESSE], représentée par [NOM]. Délégué à la protection des données : [NOM ET CONTACT].",
          "Finalités : fournir le service de coffre-fort, d'analyse et de rappels ; gérer les abonnements et crédits ; assurer la sécurité ; répondre aux obligations légales."
        ]
      },
      {
        heading: "Données traitées",
        paragraphs: [
          "Identité et coordonnées, données de compte, documents déposés et texte extrait, métadonnées (taille, dates, catégories), rappels, historique de consommation, données de facturation, journaux d'audit et données techniques.",
          "Les documents peuvent contenir des données de santé, fiscales ou familiales. Ils sont chiffrés au repos avec une clé par fichier, elle-même protégée par une clé maître."
        ]
      },
      {
        heading: "Base légale",
        paragraphs: [
          "Exécution du contrat pour le service et la facturation ; consentement pour l'analyse IA et les communications facultatives ; intérêt légitime pour la sécurité et la prévention des abus ; obligation légale pour la conservation comptable."
        ]
      },
      {
        heading: "Sous-traitants et transferts",
        paragraphs: [
          "Hébergement et base de données : [HÉBERGEUR UE]. Stockage objet : [FOURNISSEUR UE]. Paiement : Stripe. E-mail : [FOURNISSEUR]. IA : Anthropic.",
          "Les documents et les images restent dans l'UE. Pour l'analyse IA, seul le texte utile est transmis, avec une clause de non-entraînement et de zéro rétention. Tout transfert hors UE est encadré par les clauses contractuelles types et documenté dans le registre."
        ]
      },
      {
        heading: "Durées de conservation",
        paragraphs: [
          "Documents : jusqu'à suppression par l'utilisateur, puis 30 jours en corbeille. Compte supprimé : anonymisation immédiate, purge des fichiers sous 30 jours. Factures : 10 ans. Journaux d'audit : 12 mois. Journaux techniques : 6 mois."
        ]
      },
      {
        heading: "Vos droits",
        paragraphs: [
          "Accès, rectification, effacement, limitation, opposition, portabilité et retrait du consentement. L'export est disponible depuis le compte. Une réclamation peut être adressée à la CNIL.",
          "Klerio ne vend pas de données. Les documents ne sont jamais utilisés pour entraîner un modèle d'IA."
        ]
      },
      {
        heading: "Cookies et mesure d'audience",
        paragraphs: [
          "Seuls des cookies strictement nécessaires sont utilisés par défaut (session, préférence de thème). Aucun cookie publicitaire n'est déposé sans consentement.",
          "Mesure d'audience : [OUTIL, SI APPLICABLE], configurée en mode exempté ou après consentement."
        ]
      }
    ]
  }
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: DOCS[slug]?.title ?? "Informations légales" };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = DOCS[slug];
  if (!doc) notFound();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-ink-200/70 bg-[#f6f4ee]/90 dark:border-ink-800 dark:bg-ink-950/85">
        <div className="mx-auto flex min-h-[68px] w-full max-w-3xl items-center justify-between gap-4 px-4">
          <Link href="/" aria-label="Klerio, accueil">
            <Logo />
          </Link>
          <Link href="/" className="btn-ghost text-xs">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Retour
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <p className="section-title">Document juridique · brouillon</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">{doc.title}</h1>
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Dernière mise à jour : {doc.updated}</p>

        <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="flex items-start gap-2">
            <FileWarning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <strong>Brouillon.</strong> Ce texte doit être relu et validé par un juriste, complété avec les
              informations de la société et adapté à l'hébergeur retenu avant toute mise en production.
            </span>
          </p>
        </div>

        <p className="mt-5 text-sm leading-7 text-ink-700 dark:text-ink-200">{doc.intro}</p>

        <div className="mt-6 space-y-5">
          {doc.sections.map((section) => (
            <Card key={section.heading}>
              <h2 className="text-lg font-bold">{section.heading}</h2>
              <div className="mt-2 space-y-2">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-7 text-ink-700 dark:text-ink-200">
                    {paragraph}
                  </p>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-ink-500 dark:text-ink-400">
          Une question ? <Link href="/app/account" className="link">Contactez le support</Link> depuis votre compte.
        </p>
      </main>
    </div>
  );
}
