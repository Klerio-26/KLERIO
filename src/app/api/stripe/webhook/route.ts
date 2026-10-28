import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { env, stripeEnabled } from "@/lib/env";
import { getStripe, planFromPriceId } from "@/lib/billing/stripe";
import { addCredits, applyStoragePlanChange, getAccountContext } from "@/lib/quota/service";
import { audit } from "@/lib/audit";
import { deleteFamilyGroup } from "@/lib/family";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toDate(seconds: number | null | undefined): Date | null {
  return seconds ? new Date(seconds * 1000) : null;
}

function anchorFrom(date: Date | null): number {
  if (!date) return 1;
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", day: "numeric" }).format(date));
}

async function userForCustomer(customerId: string) {
  return db.user.findFirst({ where: { stripeCustomerId: customerId } });
}

async function handleSubscription(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const user = await userForCustomer(customerId);
  if (!user) return;
  const price = subscription.items.data[0]?.price;
  const mapped = planFromPriceId(price?.id) ?? (subscription.metadata.planId as "pro" | "family" | undefined);
  const ended = subscription.status === "canceled" || subscription.status === "unpaid" || subscription.status === "incomplete_expired";
  const planId = ended ? "standard" : (mapped ?? "standard");
  const interval = price?.recurring?.interval === "year" ? "yearly" : "monthly";
  // Depuis l'API Stripe 2025-03, les bornes de période vivent sur l'item d'abonnement.
  const rawSub = subscription as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  const rawItem = subscription.items.data[0] as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  const periodStart = toDate(rawSub.current_period_start ?? rawItem?.current_period_start);
  const periodEnd = toDate(rawSub.current_period_end ?? rawItem?.current_period_end);
  const anchorDay = anchorFrom(periodStart);

  const previous = await db.subscription.findUnique({ where: { userId: user.id } });
  if (previous?.planId === "family" && planId !== "family") {
    const membership = await db.familyMember.findUnique({ where: { userId: user.id } });
    if (membership?.role === "admin") {
      await deleteFamilyGroup(user.id);
    }
  }
  await db.subscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      planId,
      billingInterval: interval,
      status: ended ? "canceled" : subscription.status,
      anchorDay,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      stripeSubscriptionId: subscription.id,
      stripePriceId: price?.id
    },
    update: {
      planId,
      billingInterval: interval,
      status: ended ? "canceled" : subscription.status,
      anchorDay,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      stripeSubscriptionId: subscription.id,
      stripePriceId: price?.id
    }
  });

  if (!previous || previous.planId !== planId) {
    await applyStoragePlanChange(user.id, planId);
    await audit({
      actorId: user.id,
      action: "billing.plan.changed",
      targetType: "subscription",
      targetId: subscription.id,
      metadata: { from: previous?.planId ?? null, to: planId }
    });
  }
}

async function handleInvoice(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId || !invoice.id) return;
  const user = await userForCustomer(customerId);
  if (!user) return;
  const invoiceId = invoice.id;
  const taxCents = (invoice.total_taxes ?? []).reduce((sum, tax) => sum + (tax.amount ?? 0), 0);
  await db.invoice.upsert({
    where: { stripeInvoiceId: invoiceId },
    create: {
      userId: user.id,
      stripeInvoiceId: invoiceId,
      number: invoice.number,
      amountCents: invoice.amount_paid ?? 0,
      taxCents,
      currency: invoice.currency ?? "eur",
      status: invoice.status ?? "open",
      hostedUrl: invoice.hosted_invoice_url ?? null,
      pdfUrl: invoice.invoice_pdf ?? null,
      periodStart: toDate(invoice.period_start),
      periodEnd: toDate(invoice.period_end)
    },
    update: {
      amountCents: invoice.amount_paid ?? 0,
      taxCents,
      status: invoice.status ?? "open",
      hostedUrl: invoice.hosted_invoice_url ?? null,
      pdfUrl: invoice.invoice_pdf ?? null
    }
  });
}

export async function POST(request: NextRequest) {
  if (!stripeEnabled) {
    return NextResponse.json({ error: "Stripe non configuré." }, { status: 503 });
  }
  const stripe = getStripe();
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook Stripe non configuré." }, { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signature manquante." }, { status: 400 });

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  try {
    await db.stripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch {
    // Déjà traité : idempotence.
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscription(event.data.object as Stripe.Subscription);
        break;
      case "invoice.paid":
      case "invoice.payment_failed":
        await handleInvoice(event.data.object as Stripe.Invoice);
        break;
      case "checkout.session.completed": {
        const checkout = event.data.object as Stripe.Checkout.Session;
        const userId = checkout.metadata?.klerioUserId;
        if (!userId) break;
        if (checkout.metadata?.kind === "credits") {
          const credits = Number(checkout.metadata.credits ?? 0);
          const context = await getAccountContext(userId);
          if (credits > 0) {
            await addCredits({
              ownerType: context.walletOwnerType,
              ownerId: context.walletOwnerId,
              credits,
              reason: "achat_stripe",
              refId: checkout.id,
              metadata: { amountCents: checkout.amount_total ?? 0 }
            });
          }
          await db.invoice.upsert({
            where: { stripeInvoiceId: `credits:${checkout.id}` },
            create: {
              userId,
              stripeInvoiceId: `credits:${checkout.id}`,
              number: null,
              amountCents: checkout.amount_total ?? 0,
              taxCents: 0,
              currency: checkout.currency ?? "eur",
              status: "paid",
              hostedUrl: null,
              pdfUrl: null
            },
            update: { status: "paid" }
          });
          await audit({
            actorId: userId,
            action: "credits.purchase",
            targetType: "wallet",
            targetId: checkout.id,
            metadata: { credits, amountCents: checkout.amount_total }
          });
        }
        break;
      }
      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    // Retirer la trace d'idempotence : Stripe doit pouvoir rejouer l'événement.
    await db.stripeEvent.delete({ where: { id: event.id } }).catch(() => undefined);
    console.error("[stripe] webhook", event.type, error instanceof Error ? error.message : "inconnu");
    return NextResponse.json({ error: "Traitement impossible." }, { status: 500 });
  }
}
