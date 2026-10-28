import { describe, expect, it } from "vitest";
import { redactObject, redactPII } from "./redact";

describe("masquage des données sensibles", () => {
  it("masque une adresse e-mail", () => {
    expect(redactPII("Écrivez à nadia.lefevre@example.fr")).toContain("[email]");
    expect(redactPII("Écrivez à nadia.lefevre@example.fr")).not.toContain("nadia");
  });

  it("masque un numéro de téléphone français", () => {
    expect(redactPII("Appelez le 06 12 34 56 78")).toContain("[téléphone]");
  });

  it("masque un IBAN", () => {
    expect(redactPII("IBAN FR76 3000 6000 0112 3456 7890 189")).toContain("[IBAN]");
  });

  it("masque les secrets d'un objet", () => {
    const output = redactObject({ email: "a@b.fr", password: "secret", nested: { token: "abc" } });
    expect(output.password).toBe("[masqué]");
    expect(output.nested.token).toBe("[masqué]");
    expect(output.email).toBe("[email]");
  });

  it("laisse un texte anodin intact", () => {
    expect(redactPII("Votre quota de scan est de 20 pages.")).toBe("Votre quota de scan est de 20 pages.");
  });
});
