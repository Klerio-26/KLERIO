import "server-only";
import { env, aiEnabled } from "@/lib/env";

export interface CompletionResult {
  text: string;
  model: string;
  provider: "anthropic" | "mock";
  inputChars: number;
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
  latencyMs: number;
}

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

/**
 * Appel à l'API Claude (Anthropic) en sortie JSON.
 * Aucune image n'est envoyée : uniquement le texte extrait, minimisé.
 */
export async function completeWithClaude(input: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<CompletionResult> {
  if (!aiEnabled) throw new AiUnavailableError("Aucune clé Anthropic configurée.");
  const started = Date.now();
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL,
      max_tokens: input.maxTokens ?? 2200,
      temperature: input.temperature ?? 0,
      system: input.system,
      messages: [{ role: "user", content: input.user }]
    }),
    signal: AbortSignal.timeout(45_000)
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new AiUnavailableError(
      `Le service d'IA a répondu ${response.status}. ${body.slice(0, 200)}`
    );
  }

  const payload = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = payload.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n") ?? "";
  if (!text.trim()) throw new AiUnavailableError("Réponse vide du service d'IA.");

  const inputTokens = payload.usage?.input_tokens ?? Math.ceil((input.system.length + input.user.length) / 4);
  const outputTokens = payload.usage?.output_tokens ?? Math.ceil(text.length / 4);
  // Estimation prudente : 3 €/M entrée, 15 €/M sortie (µ€).
  const costMicros = Math.round(inputTokens * 3 + outputTokens * 15);

  return {
    text,
    model: env.ANTHROPIC_MODEL,
    provider: "anthropic",
    inputChars: input.user.length,
    inputTokens,
    outputTokens,
    costMicros,
    latencyMs: Date.now() - started
  };
}

/** Extrait un objet JSON même si le modèle ajoute des balises Markdown. */
export function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) throw new Error("Réponse IA non JSON.");
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}
