import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { randomToken } from "@/lib/security/crypto";
import { SESSION_COOKIE } from "./constants";

export { SESSION_COOKIE };
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  locale: string;
  timezone: string;
  role: string;
  twoFactorEnabled: boolean;
  onboardingDone: boolean;
  createdAt: Date;
}

export interface SessionContext {
  user: SessionUser;
  sessionId: string;
  planId: string;
  familyGroupId: string | null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function clientMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return {
    ip: forwarded ? forwarded.split(",")[0]!.trim() : h.get("x-real-ip"),
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null
  };
}

export async function createSession(userId: string): Promise<string> {
  const token = randomToken(32);
  const meta = await clientMeta();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      ip: meta.ip,
      userAgent: meta.userAgent,
      expiresAt
    }
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.updateMany({
      where: { tokenHash: hashToken(token) },
      data: { revokedAt: new Date() }
    });
  }
  store.delete(SESSION_COOKIE);
}

async function loadSession(): Promise<SessionContext | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          subscription: true,
          membership: true
        }
      }
    }
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (session.user.deletedAt) return null;
  const u = session.user;
  return {
    sessionId: session.id,
    user: {
      id: u.id,
      email: u.email,
      name: u.name,
      locale: u.locale,
      timezone: u.timezone,
      role: u.role,
      twoFactorEnabled: u.twoFactorEnabled,
      onboardingDone: u.onboardingDone,
      createdAt: u.createdAt
    },
    planId: u.membership ? "family" : (u.subscription?.planId ?? "standard"),
    familyGroupId: u.membership?.groupId ?? null
  };
}

/** Mémoïsé pour la durée d'une requête. */
export const getSession = cache(loadSession);

export async function requireUser(nextPath?: string): Promise<SessionContext> {
  const session = await getSession();
  if (!session) {
    redirect(`/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`);
  }
  return session;
}

export async function requireGuest(): Promise<void> {
  const session = await getSession();
  if (session) redirect("/app");
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const result = await db.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {})
    },
    data: { revokedAt: new Date() }
  });
  return result.count;
}

export async function listSessions(userId: string) {
  return db.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, ip: true, userAgent: true, createdAt: true, expiresAt: true }
  });
}
