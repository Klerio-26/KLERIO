import "server-only";
import Stripe from "stripe";
import { env, priceIdFor, stripeEnabled } from "@/lib/env";
import { db } from "@/lib/db";
import { getPlan, type PlanId } from "@/lib/quota/plans";

let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!stripeEnabled || !env.STRIPE_SECRET_KEY) return null;
  if (!client) client = new Stripe(env.STRIPE_SECRET_KEY);
  return client;
}

export async function ensureStripeCustomer(userId: string, email: string): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe n'est pas configuré. Ajoutez STRIPE_SECRET_KEY dans .env.");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (user?.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe.customers.create({
    email,
    metadata: { klerioUserId: userId }
  });
  await db.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

export async function createSubscriptionCheckout(input: {
  userId: string;
  email: string;
  planId: PlanId;
  interval: "monthly" | "yearly";
}): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe n'est pas configuré.");
  const price = priceIdFor(input.planId, input.interval);
  if (!price) throw new Error(`Prix Stripe manquant pour ${input.planId}/${input.interval}.`);
  const customer = await ensureStripeCustomer(input.userId, input.email);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price, quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    automatic_tax: { enabled: true },
    subscription_data: {
      metadata: { klerioUserId: input.userId, planId: input.planId, interval: input.interval }
    },
    metadata: { kind: "subscription", klerioUserId: input.userId, planId: input.planId, interval: input.interval },
    success_url: `${env.APP_URL}/app/billing?checkout=success`,
    cancel_url: `${env.APP_URL}/app/billing?checkout=cancel`
  });
  if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement.");
  return session.url;
}

export async function createCreditsCheckout(input: {
  userId: string;
  email: string;
  amountCents: number;
}): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe n'est pas configuré.");
  const customer = await ensureStripeCustomer(input.userId, input.email);
  const credits = Math.floor(input.amountCents / 10);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer,
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: input.amountCents,
          product_data: {
            name: `Crédits Klerio — ${credits} crédits`,
            description: "Crédits prépayés, sans reconduction. Utilisables pour les actions hors quota."
          }
        },
        quantity: 1
      }
    ],
    automatic_tax: { enabled: true },
    tax_id_collection: { enabled: true },
    metadata: { kind: "credits", klerioUserId: input.userId, credits: String(credits), amountCents: String(input.amountCents) },
    success_url: `${env.APP_URL}/app/billing?credits=success`,
    cancel_url: `${env.APP_URL}/app/billing?credits=cancel`
  });
  if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement.");
  return session.url;
}

export async function createBillingPortal(userId: string): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe n'est pas configuré.");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.stripeCustomerId) throw new Error("Aucun client Stripe associé à ce compte.");
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${env.APP_URL}/app/billing`
  });
  return session.url;
}

export function planFromPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  for (const planId of ["pro", "family"] as const) {
    for (const interval of ["monthly", "yearly"] as const) {
      if (priceIdFor(planId, interval) === priceId) return planId;
    }
  }
  return null;
}

export function planName(planId: string): string {
  return getPlan(planId).name;
}
