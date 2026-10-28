"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import {
  acceptFamilyInvitation,
  createFamilyGroup,
  deleteFamilyGroup,
  inviteFamilyMember,
  leaveFamilyGroup,
  removeFamilyMember,
  updateFamilySettings
} from "@/lib/family";

export interface FamilyState {
  ok: boolean;
  error?: string;
  message?: string;
  inviteUrl?: string;
}

export async function createFamilyAction(_prev: FamilyState, formData: FormData): Promise<FamilyState> {
  const { user } = await requireUser();
  try {
    const name = String(formData.get("name") ?? "").trim();
    await createFamilyGroup(user.id, name);
    revalidatePath("/app/family");
    return { ok: true, message: "Groupe famille créé." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Création impossible." };
  }
}

export async function inviteMemberAction(_prev: FamilyState, formData: FormData): Promise<FamilyState> {
  const { user } = await requireUser();
  try {
    const email = String(formData.get("email") ?? "");
    const { url } = await inviteFamilyMember(user.id, email);
    revalidatePath("/app/family");
    return { ok: true, message: "Invitation envoyée.", inviteUrl: url };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invitation impossible." };
  }
}

export async function updateFamilySettingsAction(_prev: FamilyState, formData: FormData): Promise<FamilyState> {
  const { user } = await requireUser();
  try {
    const policy = String(formData.get("quotaPolicy") ?? "shared");
    const name = String(formData.get("name") ?? "").trim();
    const memberIds = formData.getAll("memberId").map(String);
    const memberLimits = memberIds.map((memberId) => {
      const raw = String(formData.get(`limit_${memberId}`) ?? "").trim();
      const value = raw ? Number(raw.replace(",", ".")) : null;
      return { userId: memberId, limitGb: value && Number.isFinite(value) ? value : null };
    });
    await updateFamilySettings(user.id, {
      name: name || undefined,
      quotaPolicy: policy === "per_member" ? "per_member" : "shared",
      memberLimits
    });
    revalidatePath("/app/family");
    return { ok: true, message: "Réglages enregistrés." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Enregistrement impossible." };
  }
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const { user } = await requireUser();
  const memberId = String(formData.get("memberId") ?? "");
  await removeFamilyMember(user.id, memberId);
  revalidatePath("/app/family");
}

export async function leaveFamilyAction(): Promise<void> {
  const { user } = await requireUser();
  await leaveFamilyGroup(user.id);
  revalidatePath("/app/family");
}

export async function deleteFamilyAction(): Promise<void> {
  const { user } = await requireUser();
  await deleteFamilyGroup(user.id);
  revalidatePath("/app/family");
}

export async function acceptInvitationAction(_prev: FamilyState, formData: FormData): Promise<FamilyState> {
  const { user } = await requireUser();
  try {
    const token = String(formData.get("token") ?? "");
    await acceptFamilyInvitation(user.id, token);
    revalidatePath("/app/family");
    return { ok: true, message: "Vous avez rejoint le groupe famille." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invitation impossible." };
  }
}
