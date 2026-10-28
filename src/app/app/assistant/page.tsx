import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getAccountSnapshot } from "@/lib/quota/service";
import { getAccessibleDocument } from "@/lib/storage/service";
import { aiStatus } from "@/lib/ai/service";
import { formatReset } from "@/lib/quota/periods";
import { AssistantClient } from "@/components/assistant-client";

export const metadata: Metadata = { title: "Assistant" };
export const dynamic = "force-dynamic";

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ document?: string }> }) {
  const { user } = await requireUser();
  const { document: documentId } = await searchParams;
  const snapshot = await getAccountSnapshot(user.id);
  const ai = aiStatus();

  const line = (type: string) => snapshot.lines.find((l) => l.definition.type === type)!;
  const explanations = line("explanations");
  const deep = line("deep_analysis_pages");
  const emails = line("email_generations");
  const assisted = line("assisted_fills");

  let initialText = "";
  let documentTitle: string | undefined;
  if (documentId) {
    const doc = await getAccessibleDocument(user.id, documentId);
    if (doc) {
      documentTitle = doc.title;
      initialText =
        doc.ocrText?.trim() ||
        `Document « ${doc.title} » (${doc.pageCount} page${doc.pageCount > 1 ? "s" : ""}). Aucun texte n'a encore été extrait : ajoutez le texte du document ci-dessous, ou recopiez les passages importants.`;
    }
  }

  return (
    <AssistantClient
      initialText={initialText}
      documentTitle={documentTitle}
      documentId={documentId}
      userName={user.name ?? ""}
      aiMode={ai.mode}
      credits={snapshot.credits}
      creditsEnabled={snapshot.context.plan.creditsEnabled}
      quotas={{
        explanations: {
          remaining: explanations.remaining,
          limit: explanations.limit,
          resetLabel: formatReset(explanations.resetAt)
        },
        deep: {
          remaining: deep.remaining,
          limit: deep.limit,
          resetLabel: formatReset(deep.resetAt)
        },
        emails: {
          remaining: emails.remaining,
          limit: emails.limit,
          resetLabel: formatReset(emails.resetAt)
        },
        assisted: {
          remaining: assisted.remaining,
          limit: assisted.limit,
          resetLabel: formatReset(assisted.resetAt)
        }
      }}
    />
  );
}
