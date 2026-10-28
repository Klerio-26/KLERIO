import "server-only";
import { del, get, put } from "@vercel/blob";
import { env } from "@/lib/env";
import type { ObjectStorage } from "./types";

/**
 * Vercel Blob, store privé (région fra1).
 * Sur Vercel, l'authentification OIDC utilise BLOB_STORE_ID + VERCEL_OIDC_TOKEN.
 * Un BLOB_READ_WRITE_TOKEN statique peut aussi être fourni.
 */
function authOptions(): { token?: string; storeId?: string } {
  return {
    ...(env.BLOB_READ_WRITE_TOKEN ? { token: env.BLOB_READ_WRITE_TOKEN } : {}),
    ...(env.BLOB_STORE_ID ? { storeId: env.BLOB_STORE_ID } : {})
  };
}

export const blobStorage: ObjectStorage = {
  async put(key, data) {
    await put(key, data, {
      access: "private",
      addRandomSuffix: false,
      contentType: "application/octet-stream",
      ...authOptions()
    });
  },
  async get(key) {
    const result = await get(key, {
      access: "private",
      useCache: false,
      ...authOptions()
    });
    if (!result || !result.stream) throw new Error("Blob introuvable.");
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  },
  async delete(key) {
    await del(key, authOptions());
  }
};
