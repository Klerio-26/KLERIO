import "server-only";
import { env } from "@/lib/env";
import { redactPII } from "@/lib/security/redact";

/**
 * Envoi de courriels transactionnels.
 * En développement, le contenu est écrit dans la console (sans données sensibles).
 * Brancher un fournisseur UE (Brevo, Scaleway TEM, Resend) en production.
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: boolean; provider: string }> {
  if (env.EMAIL_PROVIDER === "console") {
    console.info(
      `[email:console] to=${redactPII(input.to)} subject="${input.subject}" body="${redactPII(input.text).slice(0, 300)}"`
    );
    return { ok: true, provider: "console" };
  }
  // Emplacement prévu pour le fournisseur réel.
  console.warn(`[email] fournisseur "${env.EMAIL_PROVIDER}" non implémenté : message non envoyé.`);
  return { ok: false, provider: env.EMAIL_PROVIDER };
}

export async function sendPushPlaceholder(userId: string, title: string, body: string): Promise<void> {
  console.info(`[push:stub] user=${userId} title="${title}" body="${body.slice(0, 120)}"`);
}
