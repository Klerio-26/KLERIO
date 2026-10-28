import "server-only";
import { blobEnabled, onVercel, s3Enabled } from "@/lib/env";
import { blobStorage } from "./blob";
import { localStorage } from "./local";
import { s3Storage } from "./s3";
import type { ObjectStorage } from "./types";

export type { ObjectStorage };
export { storageKeyFor } from "./key";

export function storageMode(): "s3" | "blob" | "local" {
  if (s3Enabled) return "s3";
  if (blobEnabled) return "blob";
  return "local";
}

/**
 * Retourne l'adaptateur actif.
 * Priorité : S3 (UE) → Vercel Blob privé → stockage local.
 * Sur Vercel, refuse explicitement le stockage local (éphémère et non partagé).
 */
export function getObjectStorage(): ObjectStorage {
  if (s3Enabled) return s3Storage;
  if (blobEnabled) return blobStorage;
  if (onVercel) {
    throw new Error(
      "Aucun stockage objet configuré. Sur Vercel, connectez un store Blob privé (BLOB_READ_WRITE_TOKEN) ou renseignez les variables S3_* (bucket UE)."
    );
  }
  return localStorage;
}
