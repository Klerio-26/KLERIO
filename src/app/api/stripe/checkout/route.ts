import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiUser, badRequest, handleApiError, unauthorized } from "@/lib/api";
import { env } from "@/lib/env";
import { createCreditsCheckout, createSubscriptionCheckout, getStripe } from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("subscription"),
    planId: z.enum(["pro", "family"]),
    interval: z.enum(["monthly", "yearly"])
  }),
  z.object({
    kind: z.literal("credits"),
    amountCents: z.number().int().min(200).max(2000)
  })
]);

export async function POST(request: NextRequest) {
  const session = await apiUser();
  if (!session) return unauthorized();
  if (!getStripe()) {
    return NextResponse.json(
      {
        error: "Stripe n'est pas encore configuré sur cette installation.",
        simulationAvailable: env.DEV_ALLOW_SIMULATION === "true"
      },
      { status: 503 }
    );
  }
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return badRequest("Paramètres de paiement invalides.");
    const url =
      parsed.data.kind === "subscription"
        ? await createSubscriptionCheckout({
            userId: session.user.id,
            email: session.user.email,
            planId: parsed.data.planId,
            interval: parsed.data.interval
          })
        : await createCreditsCheckout({
            userId: session.user.id,
            email: session.user.email,
            amountCents: parsed.data.amountCents
          });
    return NextResponse.json({ url });
  } catch (error) {
    return handleApiError(error);
  }
}
