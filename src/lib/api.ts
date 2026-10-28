import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { QuotaError, StorageError } from "@/lib/quota/service";
import { DeepAnalysisRequiredError } from "@/lib/ai/service";
import { redactPII } from "@/lib/security/redact";

export async function apiUser() {
  return getSession();
}

export function unauthorized() {
  return NextResponse.json({ error: "Connectez-vous pour continuer." }, { status: 401 });
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof QuotaError) {
    return NextResponse.json(
      { error: error.message, code: "quota", decision: error.decision },
      { status: 402 }
    );
  }
  if (error instanceof StorageError) {
    return NextResponse.json(
      { error: error.message, code: "storage", decision: error.decision },
      { status: 413 }
    );
  }
  if (error instanceof DeepAnalysisRequiredError) {
    return NextResponse.json(
      {
        error: "Ce document est complexe ou juridique. Une analyse approfondie est nécessaire.",
        code: "deep_required",
        detection: error.detection
      },
      { status: 409 }
    );
  }
  if (error instanceof Error && "status" in error && typeof (error as { status: unknown }).status === "number") {
    return NextResponse.json({ error: error.message }, { status: (error as { status: number }).status });
  }
  console.error("[api]", error instanceof Error ? redactPII(error.message) : "erreur inconnue");
  return NextResponse.json(
    { error: "Une erreur est survenue. Réessayez dans un instant." },
    { status: 500 }
  );
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
