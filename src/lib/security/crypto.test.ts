import { describe, expect, it } from "vitest";
import { decryptFile, encryptFile, sha256 } from "./crypto";

describe("chiffrement du coffre", () => {
  it("chiffre puis déchiffre un fichier", () => {
    const input = Buffer.from("Document administratif — données sensibles é à ç", "utf8");
    const { ciphertext, wrappedKey } = encryptFile(input);
    expect(ciphertext.toString("utf8")).not.toContain("administratif");
    expect(decryptFile(ciphertext, wrappedKey).toString("utf8")).toBe(input.toString("utf8"));
  });

  it("utilise une clé et un IV différents à chaque fichier", () => {
    const input = Buffer.from("même contenu");
    const a = encryptFile(input);
    const b = encryptFile(input);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
    expect(a.wrappedKey).not.toBe(b.wrappedKey);
  });

  it("refuse un fichier altéré", () => {
    const { ciphertext, wrappedKey } = encryptFile(Buffer.from("texte original"));
    ciphertext[ciphertext.length - 1] ^= 0xff;
    expect(() => decryptFile(ciphertext, wrappedKey)).toThrow();
  });

  it("refuse une clé enveloppe altérée", () => {
    const { ciphertext, wrappedKey } = encryptFile(Buffer.from("texte"));
    const tampered = `${wrappedKey.slice(0, -2)}AA`;
    expect(() => decryptFile(ciphertext, tampered)).toThrow();
  });

  it("calcule une empreinte stable", () => {
    expect(sha256("klerio")).toBe(sha256("klerio"));
    expect(sha256("klerio")).not.toBe(sha256("Klerio"));
  });
});
