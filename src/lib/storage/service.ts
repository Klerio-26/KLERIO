import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { decryptFile, encryptFile, sha256 } from "@/lib/security/crypto";
import { getAccountContext, assertStorage, previewStorage, StorageError } from "@/lib/quota/service";
import { getObjectStorage, storageKeyFor } from "./index";

/**
 * Vercel limite le corps des requêtes à 4,5 Mo. On garde une marge de sécurité.
 * En local, la limite est plus confortable.
 */
export const MAX_DOCUMENT_BYTES = process.env.VERCEL ? 4 * 1024 * 1024 : 25 * 1024 * 1024;
export const MAX_PDF_PAGES = 200;

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
] as const;

export interface SaveDocumentInput {
  userId: string;
  title: string;
  originalName: string;
  mimeType: string;
  bytes: Buffer;
  pageCount: number;
  categoryId?: string | null;
  tags?: string[];
  dueDate?: Date | null;
  ocrText?: string | null;
  source?: "camera" | "import" | "upload";
  visibility?: "private" | "family";
  scan?: boolean;
}

export interface SaveDocumentResult {
  documentId: string;
  duplicate: boolean;
  sizeBytes: number;
}

function sanitizeName(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 180) || "document";
}

export async function saveDocument(input: SaveDocumentInput): Promise<SaveDocumentResult> {
  const { userId, bytes } = input;
  if (!bytes.length) throw new Error("Le fichier est vide.");
  if (bytes.length > MAX_DOCUMENT_BYTES) {
    throw new Error("Fichier trop volumineux (25 Mo maximum).");
  }
  if (!ALLOWED_MIME_TYPES.includes(input.mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw new Error("Format non accepté. Utilisez un PDF, un JPEG, un PNG ou un WebP.");
  }
  const pageCount = Math.max(1, Math.min(MAX_PDF_PAGES, Math.round(input.pageCount || 1)));
  const context = await getAccountContext(userId);
  const hash = sha256(bytes);

  const existing = await db.document.findFirst({
    where: { ownerId: userId, sha256: hash, status: "active" },
    select: { id: true, sizeBytes: true }
  });
  if (existing) {
    return { documentId: existing.id, duplicate: true, sizeBytes: existing.sizeBytes };
  }

  await assertStorage(userId, bytes.length);

  const encrypted = encryptFile(bytes);
  const storageKey = storageKeyFor();
  const storage = getObjectStorage();
  await storage.put(storageKey, encrypted.ciphertext);

  try {
    const documentId = await db.$transaction(async (tx) => {
      const account = await tx.storageAccount.findUnique({
        where: {
          ownerType_ownerId: { ownerType: context.storageOwnerType, ownerId: context.storageOwnerId }
        }
      });
      if (!account) throw new Error("Compte de stockage introuvable.");
      const updated = await tx.storageAccount.updateMany({
        where: {
          id: account.id,
          usedBytes: { lte: account.limitBytes - bytes.length }
        },
        data: { usedBytes: { increment: bytes.length } }
      });
      if (updated.count === 0) {
        throw new StorageError("Espace insuffisant : le document n'a pas été enregistré.", {
          allowed: false,
          state: "full",
          usedBytes: account.usedBytes,
          limitBytes: account.limitBytes,
          incomingBytes: bytes.length,
          projectedBytes: account.usedBytes + bytes.length,
          projectedRatio: 1,
          reason: "full",
          message: "Votre coffre est plein. Vos documents restent consultables et exportables.",
          alternatives: [],
          graceEndsAt: null
        });
      }

      let categoryId: string | null = null;
      if (input.categoryId) {
        const category = await tx.category.findFirst({
          where: {
            id: input.categoryId,
            OR: [{ ownerId: userId }, { ownerId: null }]
          }
        });
        categoryId = category?.id ?? null;
      }

      const doc = await tx.document.create({
        data: {
          ownerId: userId,
          groupId: context.groupId,
          categoryId,
          title: input.title.trim().slice(0, 160) || "Document sans titre",
          originalName: sanitizeName(input.originalName),
          mimeType: input.mimeType,
          sizeBytes: bytes.length,
          pageCount,
          storageKey,
          wrappedKey: encrypted.wrappedKey,
          sha256: hash,
          tags: JSON.stringify((input.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 20)),
          visibility: context.groupId ? (input.visibility ?? "private") : "private",
          ocrText: input.ocrText?.slice(0, 50_000) ?? null,
          dueDate: input.dueDate ?? null
        }
      });

      if (input.scan) {
        await tx.scan.create({
          data: {
            userId,
            documentId: doc.id,
            pageCount,
            sizeBytes: bytes.length,
            source: input.source === "camera" ? "camera" : "import"
          }
        });
      }

      const newUsed = account.usedBytes + bytes.length;
      const ratio = account.limitBytes > 0 ? newUsed / account.limitBytes : 1;
      await tx.storageAccount.update({
        where: { id: account.id },
        data: {
          state: ratio >= 1 ? "full" : ratio >= 0.9 ? "critical" : ratio >= 0.8 ? "warning" : "normal"
        }
      });

      return doc.id;
    });

    await audit({
      actorId: userId,
      action: "document.create",
      targetType: "document",
      targetId: documentId,
      metadata: { sizeBytes: bytes.length, pageCount, mimeType: input.mimeType }
    });

    return { documentId, duplicate: false, sizeBytes: bytes.length };
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }
}

export interface AccessibleDocument {
  id: string;
  ownerId: string;
  groupId: string | null;
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number;
  storageKey: string;
  wrappedKey: string;
  visibility: string;
  status: string;
  categoryId: string | null;
  dueDate: Date | null;
  tags: string;
  ocrText: string | null;
  createdAt: Date;
  updatedAt: Date;
  purgeAt: Date | null;
  deletedAt: Date | null;
}

/**
 * Accès strict : le propriétaire, ou un membre du même groupe si le document
 * a été explicitement partagé. L'administrateur ne voit jamais les documents privés.
 */
export async function getAccessibleDocument(userId: string, documentId: string): Promise<AccessibleDocument | null> {
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) return null;
  if (doc.ownerId === userId) return doc;
  if (doc.groupId && doc.visibility === "family") {
    const member = await db.familyMember.findUnique({ where: { userId } });
    if (member?.groupId === doc.groupId) return doc;
  }
  return null;
}

export async function readDocumentBytes(doc: AccessibleDocument): Promise<Buffer> {
  const ciphertext = await getObjectStorage().get(doc.storageKey);
  return decryptFile(ciphertext, doc.wrappedKey);
}

export async function trashDocument(userId: string, documentId: string): Promise<void> {
  const doc = await db.document.findFirst({ where: { id: documentId, ownerId: userId } });
  if (!doc) throw new Error("Document introuvable.");
  if (doc.status === "trash") return;
  const now = new Date();
  await db.document.update({
    where: { id: doc.id },
    data: {
      status: "trash",
      deletedAt: now,
      purgeAt: new Date(now.getTime() + 30 * 86400000)
    }
  });
  await audit({
    actorId: userId,
    action: "document.trash",
    targetType: "document",
    targetId: doc.id,
    metadata: { purgeAt: new Date(now.getTime() + 30 * 86400000).toISOString() }
  });
}

export async function restoreDocument(userId: string, documentId: string): Promise<void> {
  const doc = await db.document.findFirst({ where: { id: documentId, ownerId: userId } });
  if (!doc) throw new Error("Document introuvable.");
  await db.document.update({
    where: { id: doc.id },
    data: { status: "active", deletedAt: null, purgeAt: null }
  });
  await audit({ actorId: userId, action: "document.restore", targetType: "document", targetId: doc.id });
}

/** Suppression définitive : libère le stockage, efface le fichier chiffré. */
export async function purgeDocument(userId: string, documentId: string, force = false): Promise<void> {
  const doc = await db.document.findFirst({ where: { id: documentId, ownerId: userId } });
  if (!doc) throw new Error("Document introuvable.");
  if (doc.status !== "trash") throw new Error("Le document doit d'abord être mis à la corbeille.");
  if (!force && doc.purgeAt && doc.purgeAt > new Date()) {
    throw new Error("La corbeille est conservée 30 jours. Vous pouvez vider la corbeille immédiatement si vous le confirmez.");
  }
  const context = await getAccountContext(userId);
  await db.$transaction(async (tx) => {
    await tx.document.delete({ where: { id: doc.id } });
    await tx.storageAccount.updateMany({
      where: { ownerType: context.storageOwnerType, ownerId: context.storageOwnerId },
      data: { usedBytes: { decrement: doc.sizeBytes } }
    });
    const account = await tx.storageAccount.findUnique({
      where: { ownerType_ownerId: { ownerType: context.storageOwnerType, ownerId: context.storageOwnerId } }
    });
    if (account) {
      const used = Math.max(0, account.usedBytes);
      if (account.state !== "read_only") {
        const ratio = account.limitBytes > 0 ? used / account.limitBytes : 1;
        await tx.storageAccount.update({
          where: { id: account.id },
          data: {
            usedBytes: used,
            state: ratio >= 1 ? "full" : ratio >= 0.9 ? "critical" : ratio >= 0.8 ? "warning" : "normal"
          }
        });
      }
    }
  });
  await getObjectStorage().delete(doc.storageKey).catch(() => undefined);
  await audit({
    actorId: userId,
    action: "document.purge",
    targetType: "document",
    targetId: doc.id,
    metadata: { sizeBytes: doc.sizeBytes }
  });
}

export async function emptyTrash(userId: string): Promise<number> {
  const docs = await db.document.findMany({
    where: { ownerId: userId, status: "trash" },
    select: { id: true }
  });
  for (const doc of docs) {
    await purgeDocument(userId, doc.id, true);
  }
  return docs.length;
}

export async function purgeExpiredTrash(): Promise<number> {
  const docs = await db.document.findMany({
    where: { status: "trash", purgeAt: { lte: new Date() } },
    select: { id: true, ownerId: true }
  });
  let count = 0;
  for (const doc of docs) {
    try {
      await purgeDocument(doc.ownerId, doc.id, true);
      count += 1;
    } catch (error) {
      console.error("[trash] purge impossible", doc.id, error instanceof Error ? error.message : "");
    }
  }
  return count;
}

export async function storagePreviewCard(userId: string, incomingBytes = 0) {
  return previewStorage(userId, incomingBytes);
}
