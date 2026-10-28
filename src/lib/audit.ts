import "server-only";
import { db } from "@/lib/db";
import { redactObject } from "@/lib/security/redact";

/** Journal d'audit des actions sensibles. Ne fait jamais échouer l'action métier. */
export async function audit(input: {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  ip?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        ip: input.ip ?? null,
        metadata: JSON.stringify(redactObject(input.metadata ?? {}))
      }
    });
  } catch (error) {
    console.error("[audit] échec d'écriture", error instanceof Error ? error.message : "inconnu");
  }
}
