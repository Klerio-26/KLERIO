import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiUser, badRequest, handleApiError, unauthorized } from "@/lib/api";
import {
  analyzeDocument,
  classifyDocument,
  fillForm,
  generateEmail,
  previewAnalysis,
  translateText
} from "@/lib/ai/service";
import { rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = "cdg1";

const analyzeSchema = z.object({
  text: z.string().min(1).max(60_000),
  fileName: z.string().max(200).optional(),
  mode: z.enum(["standard", "deep"]).default("standard"),
  pageCount: z.number().int().min(1).max(200).optional(),
  allowCredits: z.boolean().optional()
});

const previewSchema = z.object({
  text: z.string().min(1).max(60_000),
  fileName: z.string().max(200).optional(),
  pageCount: z.number().int().min(1).max(200).optional()
});

const emailRequestSchema = z.object({
  kind: z.enum(["reclamation", "contestation", "demande", "relance", "autre"]),
  tone: z.enum(["courtois", "formel", "ferme"]),
  recipient: z.string().max(200).optional(),
  subjectHint: z.string().max(200).optional(),
  context: z.string().min(20).max(20_000),
  senderName: z.string().max(120).optional(),
  allowCredits: z.boolean().optional()
});

const translateRequestSchema = z.object({
  text: z.string().min(1).max(20_000),
  targetLanguage: z.string().min(2).max(40),
  sourceLanguage: z.string().max(40).optional()
});

const fillRequestSchema = z.object({
  text: z.string().min(20).max(20_000),
  formName: z.string().max(200).optional(),
  mode: z.enum(["assisted", "autofill"]),
  allowCredits: z.boolean().optional()
});

const classifyRequestSchema = z.object({
  text: z.string().min(1).max(20_000),
  fileName: z.string().max(200).optional(),
  allowCredits: z.boolean().optional()
});

export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const session = await apiUser();
  if (!session) return unauthorized();
  const { action } = await context.params;

  const limit = rateLimit(`ai:${session.user.id}`, 40, 5 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Trop de demandes d'IA en peu de temps. Patientez quelques minutes." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Requête invalide.");
  }

  try {
    switch (action) {
      case "preview": {
        const parsed = previewSchema.safeParse(body);
        if (!parsed.success) return badRequest("Texte manquant ou trop long.");
        const result = await previewAnalysis({ userId: session.user.id, ...parsed.data });
        return NextResponse.json(result);
      }
      case "analyze": {
        const parsed = analyzeSchema.safeParse(body);
        if (!parsed.success) return badRequest("Paramètres d'analyse invalides.");
        const result = await analyzeDocument({ userId: session.user.id, ...parsed.data });
        return NextResponse.json(result);
      }
      case "email": {
        const parsed = emailRequestSchema.safeParse(body);
        if (!parsed.success) return badRequest("Décrivez votre situation en quelques phrases (20 caractères minimum).");
        const result = await generateEmail({ userId: session.user.id, ...parsed.data });
        return NextResponse.json(result);
      }
      case "translate": {
        const parsed = translateRequestSchema.safeParse(body);
        if (!parsed.success) return badRequest("Texte ou langue cible invalide.");
        const result = await translateText({ userId: session.user.id, ...parsed.data });
        return NextResponse.json(result);
      }
      case "fill": {
        const parsed = fillRequestSchema.safeParse(body);
        if (!parsed.success) return badRequest("Décrivez le formulaire et les informations disponibles.");
        const result = await fillForm({ userId: session.user.id, ...parsed.data });
        return NextResponse.json(result);
      }
      case "classify": {
        const parsed = classifyRequestSchema.safeParse(body);
        if (!parsed.success) return badRequest("Texte manquant.");
        const result = await classifyDocument({ userId: session.user.id, ...parsed.data });
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json({ error: "Action inconnue." }, { status: 404 });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
