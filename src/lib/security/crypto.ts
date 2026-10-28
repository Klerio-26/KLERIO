import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Chiffrement renforcé du coffre-fort.
 *
 * Modèle « enveloppe » :
 *  - chaque fichier est chiffré avec une clé de données (DEK) aléatoire AES-256-GCM ;
 *  - la DEK est elle-même chiffrée avec la clé maître (KEK) et stockée en base ;
 *  - les octets du fichier ne contiennent jamais la clé.
 *
 * Format binaire : "KLR1" | IV(12) | TAG(16) | CIPHERTEXT
 * Wrapped key    : base64url("KLRW1.iv.tag.ciphertext")
 */

const FILE_MAGIC = Buffer.from("KLR1");
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

let cachedKek: Buffer | null = null;

function kek(): Buffer {
  if (cachedKek) return cachedKek;
  if (env.KLERIO_MASTER_KEY) {
    const key = Buffer.from(env.KLERIO_MASTER_KEY, "base64");
    if (key.length !== 32) {
      throw new Error("KLERIO_MASTER_KEY doit être 32 octets encodés en base64.");
    }
    cachedKek = key;
    return key;
  }
  // Repli de développement uniquement : dérivé du secret de session.
  // En production, KLERIO_MASTER_KEY est obligatoire (voir README).
  if (process.env.NODE_ENV === "production") {
    throw new Error("KLERIO_MASTER_KEY manquante : refus de démarrer sans chiffrement du coffre.");
  }
  cachedKek = createHash("sha256").update(`klerio-dev-kek:${env.SESSION_SECRET}`).digest();
  return cachedKek;
}

function encryptRaw(plain: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([FILE_MAGIC, iv, tag, ciphertext]);
}

function decryptRaw(payload: Buffer, key: Buffer): Buffer {
  if (payload.subarray(0, 4).toString() !== FILE_MAGIC.toString()) {
    throw new Error("Fichier chiffré invalide (magic).");
  }
  const iv = payload.subarray(4, 4 + IV_LENGTH);
  const tag = payload.subarray(4 + IV_LENGTH, 4 + IV_LENGTH + TAG_LENGTH);
  const ciphertext = payload.subarray(4 + IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function encryptFile(plain: Buffer): { ciphertext: Buffer; wrappedKey: string } {
  const dek = randomBytes(32);
  const ciphertext = encryptRaw(plain, dek);
  const wrapped = encryptRaw(dek, kek());
  return { ciphertext, wrappedKey: wrapped.toString("base64url") };
}

export function decryptFile(ciphertext: Buffer, wrappedKey: string): Buffer {
  const wrapped = Buffer.from(wrappedKey, "base64url");
  const dek = decryptRaw(wrapped, kek());
  return decryptRaw(ciphertext, dek);
}

export function sha256(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Masque une valeur pour les journaux (jamais de données en clair). */
export function mask(value: string): string {
  if (value.length <= 4) return "***";
  return `${value.slice(0, 2)}…${value.slice(-2)}`;
}
