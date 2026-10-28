import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getAccountSnapshot } from "@/lib/quota/service";
import { formatReset } from "@/lib/quota/periods";
import { Scanner } from "@/components/scanner";
import { MAX_DOCUMENT_BYTES } from "@/lib/storage/service";

export const metadata: Metadata = { title: "Scanner un document" };
export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const { user, familyGroupId } = await requireUser();
  const snapshot = await getAccountSnapshot(user.id);
  const scan = snapshot.lines.find((line) => line.definition.type === "scan_pages")!;
  const categories = await db.category.findMany({
    where: { OR: [{ ownerId: null }, { ownerId: user.id }] },
    orderBy: [{ isSystem: "desc" }, { label: "asc" }],
    select: { id: true, label: true }
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="section-title">Scan → PDF</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Scannez, c'est tout.</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-600 dark:text-ink-300">
          Prenez une ou plusieurs photos. Klerio recadre, améliore, assemble un PDF et le range dans votre coffre
          chiffré. Le nombre de pages est toujours affiché avant l'enregistrement.
        </p>
      </header>

      <Scanner
        categories={categories}
        scan={{
          used: scan.used,
          limit: scan.limit,
          remaining: scan.remaining,
          periodicity: scan.definition.periodicity,
          resetLabel: scan.definition.periodicity === "lifetime" ? "jamais" : formatReset(scan.resetAt)
        }}
        credits={snapshot.credits}
        creditsEnabled={snapshot.context.plan.creditsEnabled}
        isFamily={Boolean(familyGroupId)}
        resetLabel={scan.definition.periodicity === "lifetime" ? "jamais (quota à vie)" : formatReset(scan.resetAt)}
        maxUploadBytes={MAX_DOCUMENT_BYTES}
      />
    </div>
  );
}
