import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { apiUser, handleApiError, unauthorized } from "@/lib/api";
import { consumeQuota, refundUsage, QuotaError, StorageError } from "@/lib/quota/service";
import { MAX_DOCUMENT_BYTES, saveDocument, ALLOWED_MIME_TYPES } from "@/lib/storage/service";
import { rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await apiUser();
  if (!session) return unauthorized();

  const limit = rateLimit(`upload:${session.user.id}`, 30, 3600_000);
  if (!limit.ok) return NextResponse.json({ error: "Trop d'envois. Réessayez dans quelques minutes." }, { status: 429 });

  let usageId: string | null = null;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
    if (file.size > MAX_DOCUMENT_BYTES) {
      const maxMb = Math.floor(MAX_DOCUMENT_BYTES / (1024 * 1024));
      return NextResponse.json(
        { error: `Fichier trop volumineux (${maxMb} Mo maximum sur cet environnement).` },
        { status: 413 }
      );
    }
    const mimeType = file.type || "application/octet-stream";
    if (!ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
      return NextResponse.json({ error: "Format non accepté (PDF, JPEG, PNG, WebP)." }, { status: 415 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    let pageCount = 1;
    if (mimeType === "application/pdf") {
      try {
        const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
        pageCount = Math.max(1, pdf.getPageCount());
      } catch {
        return NextResponse.json({ error: "Ce PDF semble illisible ou protégé." }, { status: 422 });
      }
    }

    const title = String(form.get("title") ?? "").trim() || file.name.replace(/\.[^.]+$/, "");
    const categoryId = String(form.get("categoryId") ?? "").trim() || null;
    const dueDateRaw = String(form.get("dueDate") ?? "").trim();
    const dueDate = dueDateRaw ? new Date(`${dueDateRaw}T12:00:00.000Z`) : null;
    const tags = String(form.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const source = String(form.get("source") ?? "upload") as "camera" | "import" | "upload";
    const visibility = String(form.get("visibility") ?? "private") === "family" ? "family" : "private";
    const ocrText = String(form.get("ocrText") ?? "").slice(0, 50_000) || null;
    const allowCredits = form.get("allowCredits") === "1";

    const consumption = await consumeQuota({
      userId: session.user.id,
      type: "scan_pages",
      quantity: pageCount,
      allowCredits,
      note: `scan:${file.name}`
    });
    usageId = consumption.usageId;

    const saved = await saveDocument({
      userId: session.user.id,
      title,
      originalName: file.name,
      mimeType,
      bytes,
      pageCount,
      categoryId,
      tags,
      dueDate,
      ocrText,
      source,
      visibility,
      scan: true
    });

    if (saved.duplicate) {
      await refundUsage(consumption.usageId);
      return NextResponse.json({
        ok: true,
        duplicate: true,
        documentId: saved.documentId,
        message: "Ce document est déjà dans votre coffre-fort. Aucune page n'a été débitée."
      });
    }

    return NextResponse.json({
      ok: true,
      duplicate: false,
      documentId: saved.documentId,
      quota: consumption.decision,
      creditsLeft: consumption.creditsLeft
    });
  } catch (error) {
    if (usageId && !(error instanceof QuotaError)) {
      await refundUsage(usageId).catch(() => undefined);
    }
    return handleApiError(error);
  }
}
