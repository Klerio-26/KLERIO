import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getAccountSnapshot } from "@/lib/quota/service";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: { default: "Mon espace", template: "%s · Klerio" }
};

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, familyGroupId } = await requireUser();
  const snapshot = await getAccountSnapshot(user.id);
  const scan = snapshot.lines.find((line) => line.definition.type === "scan_pages");
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  const group = familyGroupId ? await db.familyGroup.findUnique({ where: { id: familyGroupId }, select: { name: true } }) : null;

  return (
    <AppShell
      user={{ name: user.name, email: user.email }}
      planName={snapshot.context.plan.name}
      isFamily={Boolean(familyGroupId)}
      storageUsed={snapshot.storage.usedBytes}
      storageLimit={snapshot.storage.limitBytes}
      scanRemaining={scan?.remaining ?? 0}
      scanLimit={scan?.limit ?? 0}
      scanUnit={scan?.definition.unit ?? "page"}
      credits={snapshot.credits}
      unread={unread}
      familyName={group?.name ?? null}
    >
      {children}
    </AppShell>
  );
}
