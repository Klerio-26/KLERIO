import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.user.count();
    return NextResponse.json({ ok: true, service: "klerio", time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false, service: "klerio" }, { status: 503 });
  }
}
