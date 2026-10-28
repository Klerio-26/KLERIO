import { NextResponse, type NextRequest } from "next/server";
import { apiUser, handleApiError, unauthorized } from "@/lib/api";
import { getAccessibleDocument, readDocumentBytes } from "@/lib/storage/service";
import { rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await apiUser();
  if (!session) return unauthorized();
  const { id } = await context.params;

  const limit = rateLimit(`download:${session.user.id}`, 120, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Trop de téléchargements. Patientez un instant." }, { status: 429 });

  try {
    const doc = await getAccessibleDocument(session.user.id, id);
    if (!doc) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
    const bytes = await readDocumentBytes(doc);
    const download = new URL(request.url).searchParams.get("download") === "1";
    const filename = doc.originalName.replace(/["\\\r\n]/g, "_");
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Length": String(bytes.length),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'self'"
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
