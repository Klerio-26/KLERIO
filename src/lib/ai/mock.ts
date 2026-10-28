import { isOfficialDomain } from "@/lib/official-links-data";
import type { AnalysisResult, DetectionResult, EmailDraft, FillResult, TranslationResult } from "./schemas";

/**
 * Moteur de démonstration : aucune donnée ne quitte le serveur.
 * Il permet de tester tous les parcours sans clé Anthropic.
 * Les heuristiques sont volontairement lisibles et conservatrices.
 */

const DEEP_KEYWORDS = [
  "notaire",
  "acte de vente",
  "acte notarié",
  "succession",
  "testament",
  "donation",
  "hypothèque",
  "jugement",
  "assignation",
  "contrat de mariage",
  "statuts de société",
  "bail commercial",
  "acte juridique",
  " liquidation",
  "divorce par consentement"
];

const TYPE_RULES: Array<{ keywords: string[]; type: string; category: string; deep?: boolean }> = [
  { keywords: ["avis d'imposition", "impôt", "impot", "taxe", "fisc"], type: "Courrier des impôts", category: "impots" },
  { keywords: ["amende", "contravention", "infraction"], type: "Amende", category: "justice" },
  { keywords: ["facture", "échéance", "prelevement", "prélèvement"], type: "Facture", category: "consommation" },
  { keywords: ["attestation", "certificat"], type: "Attestation", category: "travail" },
  { keywords: ["bail", "loyer", "quittance", "logement", "charges locatives"], type: "Document de logement", category: "logement" },
  { keywords: ["sécurité sociale", "securite sociale", "cpam", "ameli", "remboursement", "carte vitale"], type: "Courrier de santé", category: "sante" },
  { keywords: ["france travail", "pôle emploi", "pole emploi", "allocation chômage", "are"], type: "Courrier France Travail", category: "travail" },
  { keywords: ["caf", "apl", "allocation familiale", "prime d'activité"], type: "Courrier CAF", category: "famille" },
  { keywords: ["passeport", "carte nationale d'identité", "carte d'identité", "permis de conduire"], type: "Papiers d'identité", category: "papiers" },
  { keywords: ["assurance", "sinistre", "contrat"], type: "Contrat d'assurance", category: "assurance", deep: true },
  { keywords: ["banque", "virement", "iban", "prêt", "pret"], type: "Document bancaire", category: "banque" },
  { keywords: ["inscription", "scolarité", "scolarite", "école", "ecole", "bourse"], type: "Inscription scolaire", category: "famille" },
  { keywords: ["notaire", "acte", "succession", "jugement"], type: "Acte juridique", category: "justice", deep: true }
];

const CATEGORY_TO_LINK: Record<string, string> = {
  impots: "impots-particulier",
  logement: "anil",
  sante: "ameli",
  travail: "francetravail",
  banque: "service-public-particuliers",
  assurance: "service-public-particuliers",
  famille: "caf",
  papiers: "ants",
  justice: "legifrance",
  consommation: "economie",
  loisirs: "service-public-particuliers",
  autre: "service-public-particuliers"
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function firstSentences(text: string, count = 3): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const parts = clean.split(/(?<=[.!?])\s+/).slice(0, count).join(" ");
  return parts.length > 700 ? `${parts.slice(0, 697)}…` : parts;
}

export function mockDetect(rawText: string, fileName = ""): DetectionResult {
  const text = normalize(`${fileName} ${rawText}`);
  const deepByKeyword = DEEP_KEYWORDS.some((k) => text.includes(normalize(k)));
  let best: { type: string; category: string; deep?: boolean; score: number } | null = null;
  for (const rule of TYPE_RULES) {
    const score = rule.keywords.filter((k) => text.includes(normalize(k))).length;
    if (score > 0 && (!best || score > best.score)) {
      best = { type: rule.type, category: rule.category, deep: rule.deep, score };
    }
  }
  const needsDeep = deepByKeyword || Boolean(best?.deep);
  return {
    documentType: best?.type ?? "Courrier administratif",
    categorySlug: best?.category ?? "autre",
    needsDeepAnalysis: needsDeep,
    confidence: best ? Math.min(0.92, 0.55 + best.score * 0.1) : 0.4,
    reason: needsDeep
      ? "Ce document semble juridique ou complexe : une analyse approfondie est recommandée."
      : "Document courant : l'analyse standard suffit.",
    estimatedPages: Math.max(1, Math.min(20, Math.ceil(rawText.split(/\s+/).length / 500)))
  };
}

interface DateHit {
  label: string;
  date: string | null;
}

const FRENCH_MONTHS: Record<string, number> = {
  janvier: 1,
  fevrier: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12
};

function toIsoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return d.toISOString().slice(0, 10);
}

export function extractDates(text: string): DateHit[] {
  const hits: DateHit[] = [];
  const seen = new Set<string>();

  const textual = /\b(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})\b/gi;
  for (const m of text.matchAll(textual)) {
    const month = FRENCH_MONTHS[normalize(m[2])];
    const iso = toIsoDate(Number(m[3]), month, Number(m[1]));
    if (iso && !seen.has(iso)) {
      seen.add(iso);
      hits.push({ label: `Date mentionnée : ${m[1]} ${m[2]} ${m[3]}`, date: iso });
    }
  }

  const numeric = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/g;
  for (const m of text.matchAll(numeric)) {
    const year = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
    const iso = toIsoDate(year, Number(m[2]), Number(m[1]));
    if (iso && !seen.has(iso)) {
      seen.add(iso);
      hits.push({ label: `Date mentionnée : ${m[0]}`, date: iso });
    }
  }

  return hits.slice(0, 6);
}

export function extractAmounts(text: string): Array<{ label: string; amount: number; currency: string }> {
  const out: Array<{ label: string; amount: number; currency: string }> = [];
  const regex = /(\d{1,3}(?:[ \u00a0]\d{3})*(?:[.,]\d{2})?)\s?(?:€|EUR)/gi;
  for (const m of text.matchAll(regex)) {
    const raw = m[1].replace(/[ \u00a0]/g, "").replace(",", ".");
    const amount = Number(raw);
    if (Number.isFinite(amount) && amount > 0 && out.length < 5) {
      out.push({ label: "Montant repéré dans le document", amount, currency: "EUR" });
    }
  }
  return out;
}

export interface ScamAssessment {
  score: number;
  level: "low" | "medium" | "high";
  signals: Array<{ label: string; detail: string }>;
  recommendation: string;
  confidence: number;
}

export function assessScam(text: string): ScamAssessment {
  const normalized = normalize(text);
  const signals: Array<{ label: string; detail: string }> = [];
  let score = 0;

  const urgency = ["urgent", "sous 24h", "sous 48h", "dernier avertissement", "derniere relance", "suspension immediate", "compte suspendu"];
  if (urgency.some((k) => normalized.includes(normalize(k)))) {
    score += 20;
    signals.push({
      label: "Urgence artificielle",
      detail: "Le message pousse à agir très vite pour empêcher de vérifier."
    });
  }

  const money = ["virement", "carte bancaire", "frais de dossier", "amende a payer", "paiement immediat", "payer maintenant"];
  if (money.some((k) => normalized.includes(normalize(k)))) {
    score += 15;
    signals.push({ label: "Demande de paiement", detail: "Un paiement est demandé directement dans le message." });
  }

  const sensitive = ["mot de passe", "code confidentiel", "numero de carte", "cryptogramme", "code sms", "rib complet"];
  if (sensitive.some((k) => normalized.includes(normalize(k)))) {
    score += 30;
    signals.push({
      label: "Données sensibles demandées",
      detail: "Aucun organisme sérieux ne demande ce type d'information par message."
    });
  }

  const threats = ["poursuites", "huissier", "saisie", "casier judiciaire", "penalites"];
  if (threats.some((k) => normalized.includes(normalize(k)))) {
    score += 10;
    signals.push({ label: "Menace ou intimidation", detail: "La menace vise à faire peur pour court-circuiter la vérification." });
  }

  const urls = Array.from(text.matchAll(/https?:\/\/[^\s<>"')]+/gi)).map((m) => m[0]);
  const badUrls = urls.filter((url) => {
    try {
      return !isOfficialDomain(new URL(url).hostname);
    } catch {
      return true;
    }
  });
  if (badUrls.length > 0) {
    score += Math.min(35, badUrls.length * 25);
    signals.push({
      label: "Lien suspect",
      detail: `Le message contient ${badUrls.length} lien(s) hors des domaines officiels vérifiés.`
    });
  }

  if (normalized.includes("cher client") || normalized.includes("cher abonne")) {
    score += 5;
    signals.push({ label: "Formule impersonnelle", detail: "Le message ne vous nomme pas précisément." });
  }

  score = Math.min(100, score);
  const level: "low" | "medium" | "high" = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  const recommendation =
    level === "high"
      ? "Ne payez pas et ne cliquez pas. Vérifiez directement sur le site officiel ou appelez l'organisme avec un numéro trouvé vous-même."
      : level === "medium"
        ? "Vérifiez l'expéditeur et l'adresse du site avant toute action. En cas de doute, contactez l'organisme par un canal officiel."
        : "Aucun signal fort détecté. Restez prudent : ne communiquez jamais vos mots de passe ni vos codes par message.";

  return { score, level, signals, recommendation, confidence: 0.7 };
}

const ACTION_TEMPLATES: Record<string, Array<{ title: string; detail: string; mandatory: boolean }>> = {
  impots: [
    { title: "Vérifier votre situation fiscale", detail: "Connectez-vous à impots.gouv.fr avec FranceConnect, puis comparez les informations du courrier avec votre espace.", mandatory: true },
    { title: "Rassembler les justificatifs demandés", detail: "Gardez une copie du courrier et des pièces citées dans votre coffre-fort Klerio.", mandatory: false }
  ],
  logement: [
    { title: "Rassembler le bail et les quittances", detail: "Ces pièces prouvent votre situation de locataire ou de propriétaire.", mandatory: true },
    { title: "Répondre à l'organisme par le canal officiel", detail: "Utilisez le site officiel indiqué, jamais un lien reçu par SMS.", mandatory: true }
  ],
  sante: [
    { title: "Vérifier votre dossier sur Ameli", detail: "Consultez vos remboursements et vos droits depuis ameli.fr.", mandatory: true },
    { title: "Envoyer la pièce manquante", detail: "Si un justificatif est demandé, déposez-le dans votre espace Ameli.", mandatory: false }
  ],
  travail: [
    { title: "Mettre à jour votre situation", detail: "Connectez-vous à France Travail et vérifiez les informations demandées.", mandatory: true },
    { title: "Conserver une preuve d'envoi", detail: "Téléchargez l'accusé de dépôt et rangez-le dans votre coffre-fort.", mandatory: false }
  ],
  famille: [
    { title: "Vérifier votre dossier CAF", detail: "Connectez-vous à caf.fr pour consulter les pièces attendues.", mandatory: true },
    { title: "Déclarer le changement de situation", detail: "Signalez tout changement (adresse, composition du foyer, ressources).", mandatory: true }
  ],
  papiers: [
    { title: "Préparer les pièces", detail: "Photos d'identité récentes, justificatif de domicile de moins de 3 mois, ancien titre.", mandatory: true },
    { title: "Prendre rendez-vous en mairie", detail: "La demande se fait sur ANTS, puis le dépôt est confirmé en mairie.", mandatory: true }
  ],
  justice: [
    { title: "Ne pas signer dans la précipitation", detail: "Un acte juridique engage durablement. Demandez un délai de réflexion.", mandatory: true },
    { title: "Consulter un professionnel", detail: "Pour un acte notarié ou un litige, un notaire ou un avocat peut vous accompagner.", mandatory: false }
  ],
  consommation: [
    { title: "Vérifier la facture", detail: "Comparez le montant, la date et le destinataire avec vos contrats.", mandatory: true },
    { title: "Contester si nécessaire", detail: "Klerio peut rédiger un courrier de réclamation à partir de ce document.", mandatory: false }
  ],
  autre: [
    { title: "Lire et vérifier les informations", detail: "Vérifiez que le document vous concerne bien et que l'expéditeur est identifiable.", mandatory: true },
    { title: "Classer le document", detail: "Ajoutez une échéance dans Klerio pour ne pas oublier la suite.", mandatory: false }
  ]
};

export function mockAnalysis(text: string, detection: DetectionResult): AnalysisResult {
  const scam = assessScam(text);
  const dates = extractDates(text);
  const amounts = extractAmounts(text);
  const actions = ACTION_TEMPLATES[detection.categorySlug] ?? ACTION_TEMPLATES.autre;
  const due = dates.find((d) => d.date)?.date ?? null;
  const summary = firstSentences(text);
  const category = detection.categorySlug;
  const link = CATEGORY_TO_LINK[category] ?? "service-public-particuliers";

  const risks: string[] = [];
  if (scam.level !== "low") {
    risks.push("Le message présente des signaux qui ressemblent à une tentative d'arnaque. Ne payez pas sans vérification.");
  }
  if (detection.needsDeepAnalysis) {
    risks.push("Document juridique ou complexe : les conséquences peuvent être importantes. Faites relire par un professionnel.");
  }
  risks.push("Klerio ne peut pas vérifier l'authenticité matérielle d'un courrier. En cas de doute, contactez l'organisme.");

  return {
    documentType: detection.documentType,
    categorySlug: category,
    title: detection.documentType,
    summary: summary
      ? `Il s'agit d'un ${detection.documentType.toLowerCase()}. Voici ce que le document dit, en clair : ${summary}`
      : `Ce document ressemble à un ${detection.documentType.toLowerCase()}. Le texte n'a pas pu être lu entièrement : vérifiez la photo ou saisissez le texte.`,
    keyPoints: [
      `Type détecté : ${detection.documentType}`,
      amounts.length > 0
        ? `Un montant est mentionné : ${amounts[0].amount.toFixed(2).replace(".", ",")} €.`
        : "Aucun montant à payer n'a été identifié.",
      due ? `Une échéance semble fixée au ${due.split("-").reverse().join("/")}.` : "Aucune date limite évidente n'a été trouvée."
    ],
    actions: actions.map((a, i) => ({
      ...a,
      dueDate: i === 0 ? due : null
    })),
    dates: dates.length > 0 ? dates : [{ label: "Aucune date limite détectée", date: null }],
    amounts,
    risks,
    scam,
    officialLinkSlug: scam.level === "high" ? "cybermalveillance" : link,
    needsDeepAnalysis: detection.needsDeepAnalysis,
    disclaimer:
      "Klerio vous aide à comprendre un document. Ce résumé n'est pas un conseil juridique ou fiscal. Pour une décision importante, consultez un avocat, un notaire ou un comptable.",
    confidence: detection.confidence
  };
}

export function mockEmail(input: {
  kind: string;
  tone: string;
  recipient?: string;
  subjectHint?: string;
  context: string;
  senderName?: string;
}): EmailDraft {
  const kindLabel: Record<string, string> = {
    reclamation: "Réclamation",
    contestation: "Contestation",
    demande: "Demande",
    relance: "Relance",
    autre: "Courrier"
  };
  const kind = kindLabel[input.kind] ?? "Courrier";
  const subject = input.subjectHint?.trim() || `${kind} — ${input.context.slice(0, 60)}`;
  const recipient = input.recipient?.trim() || "Madame, Monsieur";
  const tone = input.tone || "courtois";
  const intro =
    tone === "ferme"
      ? "Je vous adresse ce courrier afin d'obtenir une réponse rapide à la situation exposée ci-dessous."
      : tone === "formel"
        ? "Je vous prie de bien vouloir prendre connaissance de la situation exposée ci-dessous."
        : "Je me permets de vous écrire au sujet de la situation suivante.";
  const request =
    input.kind === "contestation"
      ? "Je conteste la décision qui m'a été notifiée et vous demande de bien vouloir la réexaminer."
      : input.kind === "relance"
        ? "Sans réponse de votre part à ce jour, je vous remercie de bien vouloir traiter ma demande dans les meilleurs délais."
        : input.kind === "reclamation"
          ? "Je vous remercie de bien vouloir corriger cette situation et de me confirmer par écrit la suite donnée."
          : "Je vous remercie de bien vouloir m'indiquer les démarches à suivre et les pièces à fournir.";

  const body = `${recipient},

${intro}

${input.context.trim()}

${request}

Je reste à votre disposition pour tout complément d'information. Je vous prie d'agréer, ${recipient === "Madame, Monsieur" ? "Madame, Monsieur" : recipient}, l'expression de mes salutations distinguées.

${input.senderName ?? "[Votre nom]"}
[Votre adresse]
[Votre téléphone]`;

  return {
    subject,
    body,
    tone,
    warnings: [
      "Relisez le courrier et complétez les informations entre crochets.",
      "Klerio ne l'envoie pas à votre place : vous gardez le contrôle.",
      input.kind === "contestation"
        ? "Une contestation peut avoir un délai légal. Vérifiez la date limite et, si besoin, consultez un professionnel."
        : "Conservez une copie et une preuve d'envoi."
    ]
  };
}

export function mockTranslation(input: { text: string; targetLanguage: string }): TranslationResult {
  return {
    detectedLanguage: "détection automatique",
    translatedText: `[Mode démonstration — ajoutez une clé Anthropic pour une traduction réelle]\n\n${input.text}`,
    notes: [
      `Langue cible demandée : ${input.targetLanguage}.`,
      "La traduction gratuite reste sans quota : elle sera réellement traduite dès que le fournisseur IA est configuré."
    ]
  };
}

export function mockFill(input: { text: string; formName?: string; mode: "assisted" | "autofill" }): FillResult {
  const email = input.text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/i)?.[0] ?? null;
  const phone = input.text.match(/(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/)?.[0] ?? null;
  const name = input.text.match(/(?:je m'appelle|nom\s*:)\s*([A-ZÉÈÀÂÎÔÛ][\p{L}-]+(?:\s+[A-ZÉÈÀÂÎÔÛ][\p{L}-]+)?)/u)?.[1] ?? null;

  return {
    fields: [
      { key: "nom", label: "Nom et prénom", value: name, question: name ? null : "Quel est votre nom complet ?", confidence: name ? 0.7 : 0 },
      { key: "email", label: "Adresse e-mail", value: email, question: email ? null : "Quelle adresse e-mail utilisez-vous ?", confidence: email ? 0.8 : 0 },
      { key: "telephone", label: "Téléphone", value: phone, question: phone ? null : "Quel numéro de téléphone pouvons-nous indiquer ?", confidence: phone ? 0.7 : 0 },
      { key: "adresse", label: "Adresse postale", value: null, question: "Quelle est votre adresse complète ?", confidence: 0 },
      { key: "date", label: "Date de la demande", value: new Date().toISOString().slice(0, 10), question: null, confidence: 0.9 }
    ],
    missing: ["adresse"],
    steps: [
      `Ouvrez le formulaire officiel ${input.formName ? `« ${input.formName} »` : ""} depuis le lien vérifié.`,
      "Recopiez les informations validées dans le récapitulatif.",
      "Vérifiez chaque champ avant de valider vous-même sur le site officiel."
    ],
    officialLinkSlug: "service-public-particuliers",
    disclaimer:
      "Klerio prépare le formulaire mais ne le soumet jamais à votre place. Vous devez relire et valider vous-même."
  };
}
