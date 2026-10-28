/**
 * Détection et masquage des données sensibles avant journalisation.
 * Ne remplace pas une revue de conformité : c'est une ceinture de sécurité.
 */

const PATTERNS: Array<{ name: string; regex: RegExp; replacement: string }> = [
  { name: "email", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: "[email]" },
  {
    name: "iban",
    regex: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g,
    replacement: "[IBAN]"
  },
  { name: "nir", regex: /\b[12][ ]?\d{2}[ ]?\d{2}[ ]?\d{2}[ ]?\d{3}[ ]?\d{3}[ ]?\d{2}\b/g, replacement: "[NIR]" },
  { name: "card", regex: /\b(?:\d[ -]?){13,19}\b/g, replacement: "[carte]" },
  { name: "phone", regex: /(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}\b/g, replacement: "[téléphone]" }
];

export function redactPII(value: string): string {
  let out = value;
  for (const p of PATTERNS) {
    out = out.replace(p.regex, p.replacement);
  }
  return out;
}

export function redactObject<T>(value: T): T {
  if (typeof value === "string") return redactPII(value) as T;
  if (Array.isArray(value)) return value.map((v) => redactObject(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lower = k.toLowerCase();
      if (["password", "passwordhash", "token", "secret", "authorization", "cookie"].includes(lower)) {
        out[k] = "[masqué]";
      } else {
        out[k] = redactObject(v);
      }
    }
    return out as T;
  }
  return value;
}

export function readableError(error: unknown): string {
  if (error instanceof Error) return redactPII(error.message);
  return "Une erreur inattendue est survenue.";
}
