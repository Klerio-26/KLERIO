import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { env, s3Enabled } from "@/lib/env";
import type { ObjectStorage } from "./types";

/**
 * Stockage objet compatible S3, région UE.
 * Chiffrement applicatif déjà appliqué : le fichier poussé est un blob AES-GCM.
 * Compatible AWS S3, Scaleway, OVH, MinIO, Cloudflare R2 (endpoint + path style).
 */
let client: S3Client | null = null;

function getClient(): S3Client {
  if (!s3Enabled) throw new Error("Stockage S3 non configuré.");
  if (!client) {
    client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT || undefined,
      forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? ""
      }
    });
  }
  return client;
}

export const s3Storage: ObjectStorage = {
  async put(key, data) {
    await getClient().send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: data,
        ContentType: "application/octet-stream",
        Metadata: { "x-klerio-encrypted": "aes-256-gcm" }
      })
    );
  },
  async get(key) {
    const response = await getClient().send(
      new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key })
    );
    if (!response.Body) throw new Error("Objet S3 vide ou introuvable.");
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  },
  async delete(key) {
    await getClient().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  }
};
