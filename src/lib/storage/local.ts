import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import type { ObjectStorage } from "./types";

/**
 * Stockage local pour le développement.
 * Sur Vercel, le système de fichiers n'est pas persistant : le stockage S3
 * (voir s3.ts) est obligatoire.
 */
const ROOT = path.resolve(process.cwd(), env.STORAGE_DIR);

function safePath(key: string): string {
  if (!/^[a-zA-Z0-9/_.-]+$/.test(key) || key.includes("..")) {
    throw new Error("Clé de stockage invalide.");
  }
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Chemin de stockage hors périmètre.");
  return full;
}

export const localStorage: ObjectStorage = {
  async put(key, data) {
    const full = safePath(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data, { mode: 0o600 });
  },
  async get(key) {
    return readFile(safePath(key));
  },
  async delete(key) {
    try {
      await unlink(safePath(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
};
