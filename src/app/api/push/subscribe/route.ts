import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiUser, badRequest, unauthorized } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(20).max(500),
    auth: z.string().min(8).max(500)
  })
});

export async function POST(request: NextRequest) {
  const session = await apiUser();
  if (!session) return unauthorized();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Abonnement push invalide.");

  await db.pushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    create: {
      userId: session.user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth
    },
    update: {
      userId: session.user.id,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth
    }
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const session = await apiUser();
  if (!session) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (endpoint) {
    await db.pushSubscription.deleteMany({ where: { endpoint, userId: session.user.id } });
  }
  return NextResponse.json({ ok: true });
}
