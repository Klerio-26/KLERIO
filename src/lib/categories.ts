/** Catégories de classement proposées à tous les utilisateurs. */
export interface CategorySeed {
  slug: string;
  label: string;
  icon: string;
}

export const CATEGORY_CATALOG: CategorySeed[] = [
  { slug: "impots", label: "Impôts et taxes", icon: "receipt" },
  { slug: "logement", label: "Logement", icon: "home" },
  { slug: "sante", label: "Santé", icon: "heart" },
  { slug: "travail", label: "Travail et emploi", icon: "briefcase" },
  { slug: "banque", label: "Banque", icon: "landmark" },
  { slug: "assurance", label: "Assurance", icon: "shield" },
  { slug: "famille", label: "Famille et scolarité", icon: "users" },
  { slug: "papiers", label: "Papiers d'identité", icon: "id-card" },
  { slug: "justice", label: "Justice et notaire", icon: "scale" },
  { slug: "consommation", label: "Consommation", icon: "shopping-bag" },
  { slug: "loisirs", label: "Loisirs et associations", icon: "ticket" },
  { slug: "autre", label: "Autre", icon: "folder" }
];

export function categoryLabel(slug: string | null | undefined): string {
  return CATEGORY_CATALOG.find((c) => c.slug === slug)?.label ?? "Non classé";
}

export function isValidCategory(slug: string): boolean {
  return CATEGORY_CATALOG.some((c) => c.slug === slug);
}
