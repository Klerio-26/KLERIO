/**
 * Catalogue des forfaits et des quotas — source de vérité produit.
 * Toute valeur est centralisée ici. Les composants UI et le moteur de quotas
 * lisent ce fichier : aucune limite ne doit être codée en dur ailleurs.
 *
 * 1 crédit = 0,10 €. Les crédits sont un compteur séparé des quotas inclus.
 */

export type PlanId = "standard" | "pro" | "family";

export type QuotaType =
  | "scan_pages"
  | "deep_analysis_pages"
  | "explanations"
  | "email_generations"
  | "assisted_fills"
  | "ai_sorting";

export type Periodicity = "lifetime" | "monthly" | "weekly";
export type QuotaScope = "user" | "group";

export interface QuotaDefinition {
  type: QuotaType;
  label: string;
  shortLabel: string;
  unit: string;
  limit: number;
  periodicity: Periodicity;
  scope: QuotaScope;
  /** true = quota individuel même dans un groupe famille (ex. scan) */
  perMember?: boolean;
  /** coût en crédits d'UNE unité au-delà du quota inclus ; null = non achetable */
  creditUnitCost: number | null;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  tagline: string;
  priceMonthlyCents: number;
  priceYearlyCents: number;
  storageBytes: number;
  maxMembers: number;
  creditsEnabled: boolean;
  features: string[];
  quotas: Record<QuotaType, QuotaDefinition>;
}

export const GB = 1024 * 1024 * 1024;

export const CREDIT_VALUE_CENTS = 10; // 1 crédit = 0,10 €
export const CREDIT_MIN_PURCHASE_CENTS = 200; // 2 €
export const CREDIT_MAX_PURCHASE_CENTS = 2000; // 20 €
export const AUTOFILL_CREDIT_COST = 30; // 3,00 €

const quota = (
  type: QuotaType,
  label: string,
  shortLabel: string,
  unit: string,
  limit: number,
  periodicity: Periodicity,
  scope: QuotaScope,
  creditUnitCost: number | null,
  perMember = false
): QuotaDefinition => ({
  type,
  label,
  shortLabel,
  unit,
  limit,
  periodicity,
  scope,
  creditUnitCost,
  perMember
});

export const PLANS: Record<PlanId, PlanDefinition> = {
  standard: {
    id: "standard",
    name: "Standard",
    tagline: "Pour démarrer sans payer.",
    priceMonthlyCents: 0,
    priceYearlyCents: 0,
    storageBytes: 10 * GB,
    maxMembers: 1,
    creditsEnabled: false,
    features: [
      "20 pages de scan au total (à vie)",
      "Coffre-fort 10 Go, classement manuel",
      "20 pages d'analyse approfondie par mois",
      "10 explications de documents par mois",
      "3 e-mails générés par semaine",
      "Traduction gratuite et illimitée",
      "Rappels de base et liens officiels"
    ],
    quotas: {
      scan_pages: quota("scan_pages", "Pages de scan", "Scan", "page", 20, "lifetime", "user", 1),
      deep_analysis_pages: quota(
        "deep_analysis_pages",
        "Analyse approfondie",
        "Analyse approfondie",
        "page",
        20,
        "monthly",
        "user",
        6
      ),
      explanations: quota("explanations", "Explications de documents", "Explications", "explication", 10, "monthly", "user", 3),
      email_generations: quota("email_generations", "E-mails et courriers", "E-mails", "génération", 3, "weekly", "user", 4),
      assisted_fills: quota("assisted_fills", "Remplissage assisté", "Remplissage assisté", "formulaire", 0, "monthly", "user", 15),
      ai_sorting: quota("ai_sorting", "Classement automatique IA", "Classement IA", "document", 0, "monthly", "user", 2)
    }
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Pour une personne qui veut aller vite.",
    priceMonthlyCents: 799,
    priceYearlyCents: 7990,
    storageBytes: 15 * GB,
    maxMembers: 1,
    creditsEnabled: true,
    features: [
      "100 pages de scan par mois",
      "Coffre-fort 15 Go + classement automatique IA",
      "100 pages d'analyse approfondie par mois",
      "300 explications par mois",
      "30 e-mails générés par semaine",
      "20 remplissages assistés par mois",
      "Rappels avancés, crédits à l'unité"
    ],
    quotas: {
      scan_pages: quota("scan_pages", "Pages de scan", "Scan", "page", 100, "monthly", "user", 1),
      deep_analysis_pages: quota(
        "deep_analysis_pages",
        "Analyse approfondie",
        "Analyse approfondie",
        "page",
        100,
        "monthly",
        "user",
        6
      ),
      explanations: quota("explanations", "Explications de documents", "Explications", "explication", 300, "monthly", "user", 3),
      email_generations: quota("email_generations", "E-mails et courriers", "E-mails", "génération", 30, "weekly", "user", 4),
      assisted_fills: quota("assisted_fills", "Remplissage assisté", "Remplissage assisté", "formulaire", 20, "monthly", "user", 15),
      ai_sorting: quota("ai_sorting", "Classement automatique IA", "Classement IA", "document", 500, "monthly", "user", 2)
    }
  },
  family: {
    id: "family",
    name: "Pro Famille",
    tagline: "Jusqu'à 5 personnes, chacun son espace.",
    priceMonthlyCents: 1299,
    priceYearlyCents: 12990,
    storageBytes: 50 * GB,
    maxMembers: 5,
    creditsEnabled: true,
    features: [
      "100 pages de scan par mois et par personne",
      "Coffre-fort partagé 50 Go (pool unique)",
      "Documents privés par défaut, partage explicite",
      "500 pages d'analyse approfondie par mois",
      "1 000 explications par mois",
      "Rappels individuels et familiaux",
      "Crédits partagés, politique de quotas réglable"
    ],
    quotas: {
      scan_pages: quota("scan_pages", "Pages de scan", "Scan", "page", 100, "monthly", "user", 1, true),
      deep_analysis_pages: quota(
        "deep_analysis_pages",
        "Analyse approfondie",
        "Analyse approfondie",
        "page",
        500,
        "monthly",
        "group",
        6
      ),
      explanations: quota("explanations", "Explications de documents", "Explications", "explication", 1000, "monthly", "group", 3),
      email_generations: quota("email_generations", "E-mails et courriers", "E-mails", "génération", 60, "weekly", "group", 4),
      assisted_fills: quota("assisted_fills", "Remplissage assisté", "Remplissage assisté", "formulaire", 100, "monthly", "group", 15),
      ai_sorting: quota("ai_sorting", "Classement automatique IA", "Classement IA", "document", 1500, "monthly", "group", 2)
    }
  }
};

export const PLAN_LIST: PlanDefinition[] = [PLANS.standard, PLANS.pro, PLANS.family];

export function isPlanId(value: string | null | undefined): value is PlanId {
  return value === "standard" || value === "pro" || value === "family";
}

export function getPlan(planId: string | null | undefined): PlanDefinition {
  return isPlanId(planId) ? PLANS[planId] : PLANS.standard;
}

export function quotaLabel(type: QuotaType): string {
  for (const plan of PLAN_LIST) {
    const q = plan.quotas[type];
    if (q) return q.label;
  }
  return type;
}

export function formatPrice(cents: number): string {
  if (cents === 0) return "0 €";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2
  }).format(cents / 100);
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 Go";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: i === 0 ? 0 : 1 }).format(value)} ${units[i]}`;
}

export function storageRatio(usedBytes: number, limitBytes: number): number {
  if (limitBytes <= 0) return 1;
  return Math.max(0, Math.min(usedBytes / limitBytes, 1));
}
