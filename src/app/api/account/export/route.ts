import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiUser, unauthorized } from "@/lib/api";
import { getAccountContext } from "@/lib/quota/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Export RGPD : données structurées, sans secrets d'authentification.
 * Les fichiers binaires restent accessibles via /api/documents/:id/file.
 */
export async function GET() {
  const session = await apiUser();
  if (!session) return unauthorized();
  const userId = session.user.id;
  const context = await getAccountContext(userId);

  const [user, subscription, membership, documents, reminders, invoices, usages, audits, consents, aiRequests, wallet, storage] =
    await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          locale: true,
          timezone: true,
          createdAt: true,
          twoFactorEnabled: true,
          onboardingDone: true
        }
      }),
      db.subscription.findUnique({ where: { userId } }),
      db.familyMember.findUnique({ where: { userId }, include: { group: { select: { id: true, name: true, quotaPolicy: true } } } }),
      db.document.findMany({
        where: { OR: [{ ownerId: userId }, { ownerId: userId, groupId: { not: null } }] },
        select: {
          id: true,
          title: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          pageCount: true,
          tags: true,
          visibility: true,
          dueDate: true,
          status: true,
          ocrText: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          purgeAt: true,
          category: { select: { label: true } }
        }
      }),
      db.reminder.findMany({ where: { userId } }),
      db.invoice.findMany({ where: { userId } }),
      db.usageRecord.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      db.auditLog.findMany({ where: { actorId: userId }, orderBy: { createdAt: "desc" }, take: 500 }),
      db.consent.findMany({ where: { userId } }),
      db.aiRequest.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { type: true, provider: true, quotaType: true, quotaDebited: true, creditsDebited: true, status: true, createdAt: true }
      }),
      db.creditWallet.findUnique({
        where: { ownerType_ownerId: { ownerType: context.walletOwnerType, ownerId: context.walletOwnerId } }
      }),
      db.storageAccount.findUnique({
        where: { ownerType_ownerId: { ownerType: context.storageOwnerType, ownerId: context.storageOwnerId } }
      })
    ]);

  const payload = {
    exportVersion: "1.0",
    generatedAt: new Date().toISOString(),
    notice:
      "Export de données Klerio. Les fichiers binaires sont disponibles séparément via /api/documents/{id}/file. Aucun mot de passe, secret 2FA ou jeton de session n'est inclus.",
    account: user,
    subscription,
    family: membership
      ? { groupId: membership.groupId, groupName: membership.group.name, role: membership.role, quotaPolicy: membership.group.quotaPolicy }
      : null,
    consents,
    documents: documents.map((doc) => ({
      ...doc,
      downloadUrl: `/api/documents/${doc.id}/file?download=1`
    })),
    reminders,
    invoices,
    quotas: {
      plan: context.planId,
      storage: storage
        ? {
            scope: context.storageOwnerType,
            usedBytes: storage.usedBytes,
            limitBytes: storage.limitBytes,
            state: storage.state
          }
        : null,
      creditBalance: wallet?.balance ?? 0
    },
    consumptionHistory: usages,
    aiRequests,
    auditLog: audits
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="klerio-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store"
    }
  });
}
