import { describe, expect, it } from "vitest";
import { assessScam, extractAmounts, extractDates, mockAnalysis, mockDetect, mockEmail, mockFill } from "./mock";

describe("détection locale des documents", () => {
  it("reconnaît un courrier des impôts", () => {
    const result = mockDetect("Avis d'imposition 2025. Votre taxe d'habitation doit être vérifiée.", "courrier.pdf");
    expect(result.categorySlug).toBe("impots");
    expect(result.needsDeepAnalysis).toBe(false);
  });

  it("impose l'analyse approfondie pour un acte notarié", () => {
    const result = mockDetect("Acte notarié de vente immobilière, succession et testament.");
    expect(result.needsDeepAnalysis).toBe(true);
    expect(result.reason).toContain("juridique");
  });

  it("extrait les dates françaises et numériques", () => {
    const dates = extractDates("À faire avant le 15 décembre 2026, et avant le 03/11/2026.");
    expect(dates.some((d) => d.date === "2026-12-15")).toBe(true);
    expect(dates.some((d) => d.date === "2026-11-03")).toBe(true);
  });

  it("extrait un montant avec espace et virgule", () => {
    const amounts = extractAmounts("Montant à payer : 1 234,56 €");
    expect(amounts[0]?.amount).toBe(1234.56);
  });
});

describe("détection d'arnaque locale", () => {
  it("signale un message urgent avec lien suspect et demande de carte", () => {
    const result = assessScam(
      "URGENT : dernier avertissement. Payez 49 € maintenant par carte bancaire sur http://bit.ly/faux-impots sous 24h."
    );
    expect(result.level).toBe("high");
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.signals.length).toBeGreaterThan(0);
    expect(result.recommendation).toContain("Ne payez pas");
  });

  it("reste prudent sur un courrier normal", () => {
    const result = assessScam("Votre attestation de droits est disponible sur ameli.fr. Aucun paiement demandé.");
    expect(result.level).toBe("low");
  });

  it("ne se laisse pas berner par un lien officiel", () => {
    const result = assessScam("Consultez votre dossier sur https://www.impots.gouv.fr/particulier.");
    expect(result.signals.some((s) => s.label.includes("lien"))).toBe(false);
  });
});

describe("sorties locales", () => {
  it("produit une analyse complète et liée à un site officiel", () => {
    const detection = mockDetect("Avis d'imposition. Date limite : 15 décembre 2026. Montant : 0,00 €.");
    const analysis = mockAnalysis("Avis d'imposition. Date limite : 15 décembre 2026.", detection);
    expect(analysis.actions.length).toBeGreaterThan(0);
    expect(analysis.officialLinkSlug).toBe("impots-particulier");
    expect(analysis.dates[0]?.date).toBe("2026-12-15");
    expect(analysis.disclaimer).toContain("conseil juridique");
  });

  it("rédige un courrier avec les mentions de contrôle", () => {
    const draft = mockEmail({
      kind: "contestation",
      tone: "formel",
      context: "Je conteste un trop-perçu de 120 € notifié le 1er octobre.",
      senderName: "Nadia Lefèvre"
    });
    expect(draft.subject).toContain("Contestation");
    expect(draft.body).toContain("Nadia Lefèvre");
    expect(draft.warnings.length).toBeGreaterThan(0);
  });

  it("prépare un récapitulatif de formulaire sans soumettre", () => {
    const fill = mockFill({
      text: "Je m'appelle Nadia Lefèvre, mon email est nadia@example.fr, téléphone 06 12 34 56 78.",
      mode: "assisted"
    });
    expect(fill.fields.some((f) => f.key === "email" && f.value === "nadia@example.fr")).toBe(true);
    expect(fill.disclaimer).toContain("ne le soumet jamais");
  });
});
