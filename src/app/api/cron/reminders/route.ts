import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { runReminderCron } from "@/lib/reminders";
import { purgeExpiredTrash } from "@/lib/storage/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization");
  const query = new URL(request.url).searchParams.get("secret");
  return header === `Bearer ${secret}` || query === secret;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const [reminders, purged] = await Promise.all([runReminderCron(), purgeExpiredTrash()]);
  return NextResponse.json({ ok: true, reminders, purgedDocuments: purged });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
