import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { getPlan, GB, formatBytes } from "@/lib/quota/plans";
import { randomToken, sha256 } from "@/lib/security/crypto";
import { applyStoragePlanChange, getAccountContext } from "@/lib/quota/service";

const MAX_MEMBERS = 5;

async function transferCreditsToGroup(userId: string, groupId: string, reason: string): Promise<void> {
  const personal = await db.creditWallet.findUnique({
    where: { ownerType_ownerId: { ownerType: "user", ownerId: userId } }
  });
  if (!personal || personal.balance <= 0) return;
  await db.$transaction(async (tx) => {
    const groupWallet = await tx.creditWallet.upsert({
      where: { ownerType_ownerId: { ownerType: "group", ownerId: groupId } },
      create: { ownerType: "group", ownerId: groupId, balance: 0 },
      update: {}
    });
    await tx.creditWallet.update({ where: { id: personal.id }, data: { balance: 0 } });
    await tx.creditWallet.update({
      where: { id: groupWallet.id },
      data: { balance: { increment: personal.balance } }
    });
    await tx.creditTransaction.create({
      data: { walletId: personal.id, delta: -personal.balance, reason: `transfert_famille:${reason}` }
    });
    await tx.creditTransaction.create({
      data: { walletId: groupWallet.id, delta: personal.balance, reason: `transfert_membre:${reason}` }
    });
  });
}

/**
 * Rattache les documents existants au pool famille.
 * Ils restent privés (visibility inchangée) mais leurs octets rejoignent le compteur du groupe.
 */
async function attachDocumentsToGroup(userId: string, groupId: string): Promise<void> {
  const docs = await db.document.findMany({
    where: { ownerId: userId, groupId: null },
    select: { id: true, sizeBytes: true }
  });
  if (docs.length === 0) return;
  const bytes = docs.reduce((sum, doc) => sum + doc.sizeBytes, 0);
  await db.$transaction(async (tx) => {
    await tx.document.updateMany({ where: { ownerId: userId, groupId: null }, data: { groupId } });
    const groupAccount = await tx.storageAccount.upsert({
      where: { ownerType_ownerId: { ownerType: "group", ownerId: groupId } },
      create: {
        ownerType: "group",
        ownerId: groupId,
        usedBytes: 0,
        limitBytes: getPlan("family").storageBytes,
        state: "normal"
      },
      update: {}
    });
    const used = groupAccount.usedBytes + bytes;
    const ratio = groupAccount.limitBytes > 0 ? used / groupAccount.limitBytes : 1;
    await tx.storageAccount.update({
      where: { id: groupAccount.id },
      data: {
        usedBytes: used,
        state: ratio >= 1 ? "full" : ratio >= 0.9 ? "critical" : ratio >= 0.8 ? "warning" : "normal"
      }
    });
    const personal = await tx.storageAccount.findUnique({
      where: { ownerType_ownerId: { ownerType: "user", ownerId: userId } }
    });
    if (personal) {
      const personalUsed = Math.max(0, personal.usedBytes - bytes);
      await tx.storageAccount.update({
        where: { id: personal.id },
        data: { usedBytes: personalUsed, state: "normal", graceEndsAt: null }
      });
    }
  });
}

async function requireAdmin(userId: string) {
  const membership = await db.familyMember.findUnique({
    where: { userId },
    include: { group: true }
  });
  if (!membership || membership.role !== "admin") {
    throw new Error("Seul l'administrateur du groupe peut effectuer cette action.");
  }
  return membership;
}

export async function createFamilyGroup(userId: string, name: string): Promise<string> {
  const subscription = await db.subscription.findUnique({ where: { userId } });
  if (subscription?.planId !== "family") {
    throw new Error("Activez d'abord le forfait Pro Famille pour créer un groupe.");
  }
  const existing = await db.familyMember.findUnique({ where: { userId } });
  if (existing) throw new Error("Vous faites déjà partie d'un groupe famille.");

  const group = await db.familyGroup.create({
    data: {
      name: name.trim().slice(0, 80) || "Ma famille",
      adminId: userId,
      planId: "family",
      storageLimitBytes: getPlan("family").storageBytes,
      members: { create: { userId, role: "admin" } }
    }
  });
  await db.storageAccount.upsert({
    where: { ownerType_ownerId: { ownerType: "group", ownerId: group.id } },
    create: {
      ownerType: "group",
      ownerId: group.id,
      usedBytes: 0,
      limitBytes: getPlan("family").storageBytes,
      state: "normal"
    },
    update: { limitBytes: getPlan("family").storageBytes }
  });
  await attachDocumentsToGroup(userId, group.id);
  await transferCreditsToGroup(userId, group.id, "creation");
  await audit({ actorId: userId, action: "family.create", targetType: "family", targetId: group.id });
  return group.id;
}

export async function inviteFamilyMember(adminId: string, email: string): Promise<{ url: string }> {
  const membership = await requireAdmin(adminId);
  const cleanEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error("Adresse e-mail invalide.");

  const count = await db.familyMember.count({ where: { groupId: membership.groupId } });
  if (count >= MAX_MEMBERS) throw new Error("Le groupe est complet (5 personnes maximum, administrateur inclus).");

  const already = await db.user.findUnique({ where: { email: cleanEmail } });
  if (already) {
    const existingMember = await db.familyMember.findUnique({ where: { userId: already.id } });
    if (existingMember) throw new Error("Cette personne fait déjà partie d'un groupe famille.");
  }

  const token = randomToken(24);
  await db.familyInvitation.create({
    data: {
      groupId: membership.groupId,
      email: cleanEmail,
      tokenHash: sha256(token),
      invitedBy: adminId,
      expiresAt: new Date(Date.now() + 7 * 86400000)
    }
  });
  const url = `${env.APP_URL}/family/join?token=${token}`;
  await sendEmail({
    to: cleanEmail,
    subject: `Invitation à rejoindre « ${membership.group.name} » sur Klerio`,
    text: `Vous avez été invité(e) à rejoindre le groupe famille « ${membership.group.name} » sur Klerio.\n\nOuvrez ce lien pour accepter : ${url}\n\nCe lien expire dans 7 jours. Vos documents resteront privés : l'administrateur ne peut pas les consulter.`
  });
  await audit({
    actorId: adminId,
    action: "family.invite",
    targetType: "family",
    targetId: membership.groupId,
    metadata: { email: cleanEmail }
  });
  return { url };
}

export async function acceptFamilyInvitation(userId: string, token: string): Promise<string> {
  const invitation = await db.familyInvitation.findUnique({
    where: { tokenHash: sha256(token) },
    include: { group: true }
  });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    throw new Error("Invitation invalide ou expirée.");
  }
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new Error("Cette invitation ne correspond pas à votre adresse e-mail.");
  }
  const existing = await db.familyMember.findUnique({ where: { userId } });
  if (existing) throw new Error("Vous faites déjà partie d'un groupe famille.");
  const count = await db.familyMember.count({ where: { groupId: invitation.groupId } });
  if (count >= MAX_MEMBERS) throw new Error("Le groupe est complet.");

  await db.$transaction([
    db.familyMember.create({
      data: { groupId: invitation.groupId, userId, role: "member" }
    }),
    db.familyInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() }
    })
  ]);

  await attachDocumentsToGroup(userId, invitation.groupId);
  await transferCreditsToGroup(userId, invitation.groupId, "adhesion");
  await audit({
    actorId: userId,
    action: "family.join",
    targetType: "family",
    targetId: invitation.groupId
  });
  return invitation.groupId;
}

async function detachMemberDocuments(userId: string, groupId: string): Promise<number> {
  const docs = await db.document.findMany({
    where: { ownerId: userId, groupId },
    select: { id: true, sizeBytes: true }
  });
  const bytes = docs.reduce((sum, d) => sum + d.sizeBytes, 0);
  if (docs.length > 0) {
    await db.document.updateMany({
      where: { ownerId: userId, groupId },
      data: { groupId: null, visibility: "private" }
    });
  }
  return bytes;
}

/** Après un départ, le stockage personnel est recalculé ; jamais de suppression. */
export async function reconcilePersonalStorage(userId: string): Promise<void> {
  const docs = await db.document.aggregate({
    where: { ownerId: userId, status: { in: ["active", "trash"] } },
    _sum: { sizeBytes: true }
  });
  const used = docs._sum.sizeBytes ?? 0;
  const subscription = await db.subscription.findUnique({ where: { userId } });
  const limit = getPlan(subscription?.planId).storageBytes;
  const existing = await db.storageAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "user", ownerId: userId } }
  });
  const over = used > limit;
  await db.storageAccount.upsert({
    where: { ownerType_ownerId: { ownerType: "user", ownerId: userId } },
    create: {
      ownerType: "user",
      ownerId: userId,
      usedBytes: used,
      limitBytes: limit,
      state: over ? "read_only" : "normal",
      graceEndsAt: over ? new Date(Date.now() + 60 * 86400000) : null
    },
    update: {
      usedBytes: used,
      limitBytes: limit,
      ...(over
        ? { state: "read_only", graceEndsAt: existing?.graceEndsAt ?? new Date(Date.now() + 60 * 86400000) }
        : {
            state: used >= limit ? "full" : used >= limit * 0.9 ? "critical" : used >= limit * 0.8 ? "warning" : "normal",
            graceEndsAt: null
          })
    }
  });
}

async function releaseStorage(groupId: string, bytes: number): Promise<void> {
  if (bytes <= 0) return;
  const account = await db.storageAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "group", ownerId: groupId } }
  });
  if (!account) return;
  const used = Math.max(0, account.usedBytes - bytes);
  const ratio = account.limitBytes > 0 ? used / account.limitBytes : 1;
  await db.storageAccount.update({
    where: { id: account.id },
    data: {
      usedBytes: used,
      state: ratio >= 1 ? "full" : ratio >= 0.9 ? "critical" : ratio >= 0.8 ? "warning" : "normal"
    }
  });
}

export async function removeFamilyMember(adminId: string, memberUserId: string): Promise<void> {
  const admin = await requireAdmin(adminId);
  if (memberUserId === adminId) throw new Error("L'administrateur ne peut pas se retirer ainsi.");
  const target = await db.familyMember.findUnique({ where: { userId: memberUserId } });
  if (!target || target.groupId !== admin.groupId) throw new Error("Membre introuvable dans ce groupe.");
  const bytes = await detachMemberDocuments(memberUserId, admin.groupId);
  await db.familyMember.delete({ where: { userId: memberUserId } });
  await releaseStorage(admin.groupId, bytes);
  await reconcilePersonalStorage(memberUserId);
  await audit({
    actorId: adminId,
    action: "family.remove_member",
    targetType: "user",
    targetId: memberUserId,
    metadata: { detachedBytes: bytes }
  });
}

export async function leaveFamilyGroup(userId: string): Promise<void> {
  const membership = await db.familyMember.findUnique({ where: { userId }, include: { group: true } });
  if (!membership) throw new Error("Vous ne faites partie d'aucun groupe.");
  if (membership.role === "admin") {
    throw new Error("L'administrateur doit d'abord supprimer le groupe ou transférer son rôle.");
  }
  const bytes = await detachMemberDocuments(userId, membership.groupId);
  await db.familyMember.delete({ where: { userId } });
  await releaseStorage(membership.groupId, bytes);
  await reconcilePersonalStorage(userId);
  await audit({ actorId: userId, action: "family.leave", targetType: "family", targetId: membership.groupId });
}

export async function updateFamilySettings(
  adminId: string,
  input: {
    name?: string;
    quotaPolicy?: "shared" | "per_member";
    memberLimits?: Array<{ userId: string; limitGb: number | null }>;
  }
): Promise<void> {
  const admin = await requireAdmin(adminId);
  if (input.quotaPolicy && input.quotaPolicy !== "shared" && input.quotaPolicy !== "per_member") {
    throw new Error("Politique de quotas invalide.");
  }
  await db.familyGroup.update({
    where: { id: admin.groupId },
    data: {
      ...(input.name ? { name: input.name.trim().slice(0, 80) } : {}),
      ...(input.quotaPolicy ? { quotaPolicy: input.quotaPolicy } : {})
    }
  });
  for (const limit of input.memberLimits ?? []) {
    const member = await db.familyMember.findUnique({ where: { userId: limit.userId } });
    if (!member || member.groupId !== admin.groupId) continue;
    const bytes = limit.limitGb === null ? null : Math.min(50, Math.max(0.1, limit.limitGb)) * GB;
    await db.familyMember.update({
      where: { userId: limit.userId },
      data: { storageLimitBytes: bytes }
    });
  }
  await audit({
    actorId: adminId,
    action: "family.update",
    targetType: "family",
    targetId: admin.groupId,
    metadata: { policy: input.quotaPolicy }
  });
}

export async function deleteFamilyGroup(adminId: string): Promise<void> {
  const admin = await requireAdmin(adminId);
  const groupId = admin.groupId;
  const members = await db.familyMember.findMany({ where: { groupId } });

  // Le solde de crédits du groupe revient à l'administrateur : il ne doit pas disparaître.
  const groupWallet = await db.creditWallet.findUnique({
    where: { ownerType_ownerId: { ownerType: "group", ownerId: groupId } }
  });
  if (groupWallet && groupWallet.balance > 0) {
    const adminWallet = await db.creditWallet.upsert({
      where: { ownerType_ownerId: { ownerType: "user", ownerId: adminId } },
      create: { ownerType: "user", ownerId: adminId, balance: 0 },
      update: {}
    });
    await db.$transaction([
      db.creditWallet.update({ where: { id: adminWallet.id }, data: { balance: { increment: groupWallet.balance } } }),
      db.creditWallet.update({ where: { id: groupWallet.id }, data: { balance: 0 } }),
      db.creditTransaction.create({
        data: { walletId: adminWallet.id, delta: groupWallet.balance, reason: "transfert_fin_groupe" }
      })
    ]);
  }

  for (const member of members) {
    await detachMemberDocuments(member.userId, groupId);
  }
  await db.familyMember.deleteMany({ where: { groupId } });
  await db.storageAccount.deleteMany({ where: { ownerType: "group", ownerId: groupId } });
  await db.familyGroup.delete({ where: { id: groupId } });
  for (const member of members) {
    await reconcilePersonalStorage(member.userId);
  }
  await audit({ actorId: adminId, action: "family.delete", targetType: "family", targetId: groupId });
}

export async function shareDocumentWithFamily(userId: string, documentId: string, share: boolean): Promise<void> {
  const context = await getAccountContext(userId);
  if (!context.groupId) throw new Error("Vous n'êtes pas dans un groupe famille.");
  const doc = await db.document.findFirst({ where: { id: documentId, ownerId: userId } });
  if (!doc) throw new Error("Document introuvable.");
  await db.document.update({
    where: { id: doc.id },
    data: { visibility: share ? "family" : "private", groupId: context.groupId }
  });
  await audit({
    actorId: userId,
    action: share ? "document.share" : "document.unshare",
    targetType: "document",
    targetId: doc.id
  });
}

export async function getFamilyOverview(userId: string) {
  const membership = await db.familyMember.findUnique({
    where: { userId },
    include: { group: { include: { invitations: { where: { acceptedAt: null, expiresAt: { gt: new Date() } } } } } }
  });
  if (!membership) return null;

  const members = await db.familyMember.findMany({
    where: { groupId: membership.groupId },
    include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
    orderBy: { joinedAt: "asc" }
  });

  const memberUsage = await Promise.all(
    members.map(async (m) => {
      const agg = await db.document.aggregate({
        where: { ownerId: m.userId, status: { in: ["active", "trash"] } },
        _sum: { sizeBytes: true },
        _count: true
      });
      return {
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        joinedAt: m.joinedAt,
        storageLimitBytes: m.storageLimitBytes,
        usedBytes: agg._sum.sizeBytes ?? 0,
        documentCount: agg._count
      };
    })
  );

  const storage = await db.storageAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "group", ownerId: membership.groupId } }
  });

  return {
    group: membership.group,
    role: membership.role,
    members: memberUsage,
    invitations:
      membership.role === "admin"
        ? membership.group.invitations.map((invitation) => ({
            id: invitation.id,
            email: invitation.email,
            expiresAt: invitation.expiresAt,
            createdAt: invitation.createdAt
          }))
        : [],
    storage: {
      usedBytes: storage?.usedBytes ?? 0,
      limitBytes: storage?.limitBytes ?? getPlan("family").storageBytes,
      label: `${formatBytes(storage?.usedBytes ?? 0)} / ${formatBytes(storage?.limitBytes ?? getPlan("family").storageBytes)}`
    },
    maxMembers: MAX_MEMBERS
  };
}

export async function transferFamilyAdmin(adminId: string, newAdminUserId: string): Promise<void> {
  const admin = await requireAdmin(adminId);
  const target = await db.familyMember.findUnique({ where: { userId: newAdminUserId } });
  if (!target || target.groupId !== admin.groupId) throw new Error("Membre introuvable.");
  await db.$transaction([
    db.familyMember.update({ where: { userId: adminId }, data: { role: "member" } }),
    db.familyMember.update({ where: { userId: newAdminUserId }, data: { role: "admin" } }),
    db.familyGroup.update({ where: { id: admin.groupId }, data: { adminId: newAdminUserId } })
  ]);
  await applyStoragePlanChange(newAdminUserId, "family");
  await audit({ actorId: adminId, action: "family.transfer_admin", targetType: "user", targetId: newAdminUserId });
}
