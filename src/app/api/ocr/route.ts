import { NextResponse, type NextRequest } from "next/server";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { apiUser, handleApiError, unauthorized } from "@/lib/api";
import { rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = "cdg1";

const MAX_BYTES = 12 * 1024 * 1024;
// Vercel ne fournit que /tmp en écriture ; le modèle est retéléchargé à froid.
const CACHE_PATH = process.env.VERCEL
  ? "/tmp/klerio-ocr"
  : path.resolve(process.cwd(), "storage", "ocr-cache");

/**
 * OCR serveur (Tesseract, français).
 * Le premier appel télécharge le modèle de langue (~15 Mo) dans storage/ocr-cache.
 * Aucun document n'est conservé : le buffer est traité en mémoire.
 */
export async function POST(request: NextRequest) {
  const session = await apiUser();
  if (!session) return unauthorized();

  const limit = rateLimit(`ocr:${session.user.id}`, 20, 60 * 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Trop de demandes OCR. Réessayez dans quelques minutes." }, { status: 429 });
  }

  try {
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Aucune image reçue." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Format non accepté : envoyez une image JPEG ou PNG." }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image trop volumineuse (12 Mo maximum)." }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    mkdirSync(CACHE_PATH, { recursive: true });
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("fra", 1, {
      cachePath: CACHE_PATH,
      logger: () => undefined
    });
    try {
      const result = await worker.recognize(buffer);
      const text = String(result.data.text ?? "")
        .replace(/\r/g, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, 50_000);
      return NextResponse.json({
        ok: true,
        text,
        confidence: result.data.confidence ?? null,
        language: "fra"
      });
    } finally {
      await worker.terminate().catch(() => undefined);
    }
  } catch (error) {
    console.error("[ocr]", error instanceof Error ? error.message : "inconnu");
    return handleApiError(
      new Error(
        "L'OCR n'a pas pu démarrer. Vérifiez la connexion au serveur de langues, ou saisissez le texte à la main."
      )
    );
  }
}
