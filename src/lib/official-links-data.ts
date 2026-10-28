/**
 * Base de liens officiels vérifiés.
 * L'IA ne génère JAMAIS d'URL : elle ne peut choisir qu'un `slug` de cette liste.
 * Mise à jour : vérifier manuellement la page, puis modifier `verifiedAt`.
 */

export interface OfficialLinkSeed {
  slug: string;
  label: string;
  url: string;
  domain: string;
  category: string;
  description: string;
  verifiedAt: string;
}

const verifiedAt = "2026-10-01T00:00:00.000Z";

export const OFFICIAL_LINKS: OfficialLinkSeed[] = [
  {
    slug: "service-public",
    label: "Service-public.fr",
    url: "https://www.service-public.fr/",
    domain: "service-public.fr",
    category: "Général",
    description: "Le site officiel de l'administration française."
  },
  {
    slug: "service-public-particuliers",
    label: "Service-public — particuliers",
    url: "https://www.service-public.fr/particuliers",
    domain: "service-public.fr",
    category: "Général",
    description: "Démarches et droits des particuliers."
  },
  {
    slug: "impots",
    label: "Impots.gouv.fr",
    url: "https://www.impots.gouv.fr/accueil",
    domain: "impots.gouv.fr",
    category: "Impôts",
    description: "Déclaration de revenus, taxe d'habitation, paiement des impôts."
  },
  {
    slug: "impots-particulier",
    label: "Impots.gouv — espace particulier",
    url: "https://www.impots.gouv.fr/particulier",
    domain: "impots.gouv.fr",
    category: "Impôts",
    description: "Votre espace personnel fiscal."
  },
  {
    slug: "ameli",
    label: "Ameli.fr",
    url: "https://www.ameli.fr/",
    domain: "ameli.fr",
    category: "Santé",
    description: "Assurance Maladie : remboursements, carte Vitale, arrêt de travail."
  },
  {
    slug: "caf",
    label: "Caf.fr",
    url: "https://www.caf.fr/",
    domain: "caf.fr",
    category: "Prestations sociales",
    description: "Allocations familiales, APL, RSA, prime d'activité."
  },
  {
    slug: "francetravail",
    label: "France Travail",
    url: "https://www.francetravail.fr/",
    domain: "francetravail.fr",
    category: "Travail",
    description: "Recherche d'emploi, allocation chômage, formation."
  },
  {
    slug: "urssaf",
    label: "Urssaf",
    url: "https://www.urssaf.fr/",
    domain: "urssaf.fr",
    category: "Travail",
    description: "Cotisations sociales, auto-entrepreneurs, attestations."
  },
  {
    slug: "info-retraite",
    label: "Info-retraite",
    url: "https://www.info-retraite.fr/",
    domain: "info-retraite.fr",
    category: "Retraite",
    description: "Relevé de carrière et simulation de retraite."
  },
  {
    slug: "ants",
    label: "ANTS",
    url: "https://ants.gouv.fr/",
    domain: "ants.gouv.fr",
    category: "Papiers d'identité",
    description: "Passeport, carte d'identité, permis de conduire, carte grise."
  },
  {
    slug: "interieur",
    label: "Ministère de l'Intérieur",
    url: "https://www.interieur.gouv.fr/",
    domain: "interieur.gouv.fr",
    category: "Papiers d'identité",
    description: "Démarches liées aux titres et à la sécurité."
  },
  {
    slug: "legifrance",
    label: "Légifrance",
    url: "https://www.legifrance.gouv.fr/",
    domain: "legifrance.gouv.fr",
    category: "Droit",
    description: "Textes de loi et codes en vigueur."
  },
  {
    slug: "economie",
    label: "Economie.gouv.fr",
    url: "https://www.economie.gouv.fr/",
    domain: "economie.gouv.fr",
    category: "Consommation",
    description: "Information économique et droits des consommateurs."
  },
  {
    slug: "anil",
    label: "ANIL — logement",
    url: "https://www.anil.org/",
    domain: "anil.org",
    category: "Logement",
    description: "Informations sur le logement, la location et la copropriété."
  },
  {
    slug: "cnil",
    label: "CNIL",
    url: "https://www.cnil.fr/",
    domain: "cnil.fr",
    category: "Données personnelles",
    description: "Protection des données et exercice de vos droits."
  },
  {
    slug: "cybermalveillance",
    label: "Cybermalveillance.gouv.fr",
    url: "https://www.cybermalveillance.gouv.fr/",
    domain: "cybermalveillance.gouv.fr",
    category: "Arnaques",
    description: "Aide en cas de phishing, fraude ou piratage."
  },
  {
    slug: "service-public-arnaques",
    label: "Service-public — arnaques",
    url: "https://www.service-public.fr/particuliers/vosdroits/F34362",
    domain: "service-public.fr",
    category: "Arnaques",
    description: "Reconnaître et signaler une tentative d'escroquerie."
  },
  {
    slug: "msa",
    label: "MSA",
    url: "https://www.msa.fr/",
    domain: "msa.fr",
    category: "Santé",
    description: "Protection sociale agricole."
  },
  {
    slug: "monparcourshandicap",
    label: "Mon Parcours Handicap",
    url: "https://www.monparcourshandicap.gouv.fr/",
    domain: "monparcourshandicap.gouv.fr",
    category: "Social",
    description: "Droits et démarches des personnes en situation de handicap."
  },
  {
    slug: "education",
    label: "Éducation nationale",
    url: "https://www.education.gouv.fr/",
    domain: "education.gouv.fr",
    category: "Scolarité",
    description: "Inscription scolaire, bourses, vie scolaire."
  }
].map((link) => ({ ...link, verifiedAt }));

export const OFFICIAL_DOMAINS = Array.from(new Set(OFFICIAL_LINKS.map((l) => l.domain)));

export function isOfficialDomain(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return OFFICIAL_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function findOfficialLink(slug: string | null | undefined) {
  if (!slug) return null;
  return OFFICIAL_LINKS.find((l) => l.slug === slug) ?? null;
}
