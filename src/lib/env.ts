import { z } from "zod";

/**
 * Variables d'environnement. Les secrets ne sont jamais exposés au client :
 * ce module est importé uniquement par du code serveur.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET doit faire au moins 32 caractères"),
  KLERIO_MASTER_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  AI_PROVIDER: z.enum(["auto", "mock", "anthropic"]).default("auto"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-5"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PRO_YEARLY: z.string().optional(),
  STRIPE_PRICE_FAMILY_MONTHLY: z.string().optional(),
  STRIPE_PRICE_FAMILY_YEARLY: z.string().optional(),
  EMAIL_PROVIDER: z.string().default("console"),
  EMAIL_FROM: z.string().default("Klerio <bonjour@klerio.fr>"),
  DEV_ALLOW_SIMULATION: z.string().default("false"),
  STORAGE_DIR: z.string().default("./storage"),
  S3_REGION: z.string().default("eu-west-3"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().optional()
  ),
  S3_FORCE_PATH_STYLE: z.string().default("false"),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional()
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Configuration Klerio invalide.\n${details}\nCopiez .env.example vers .env.`);
}

export const env = parsed.data;

export const isDev = process.env.NODE_ENV !== "production";
export const allowSimulation =
  isDev && env.DEV_ALLOW_SIMULATION !== "false" && !process.env.VERCEL;

export const aiEnabled =
  Boolean(env.ANTHROPIC_API_KEY) &&
  (env.AI_PROVIDER === "anthropic" || env.AI_PROVIDER === "auto");
export const stripeEnabled = Boolean(env.STRIPE_SECRET_KEY);
export const s3Enabled = Boolean(env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);
export const onVercel = process.env.VERCEL === "1";

export const stripePriceIds: Record<string, string | undefined> = {
  "pro:monthly": env.STRIPE_PRICE_PRO_MONTHLY,
  "pro:yearly": env.STRIPE_PRICE_PRO_YEARLY,
  "family:monthly": env.STRIPE_PRICE_FAMILY_MONTHLY,
  "family:yearly": env.STRIPE_PRICE_FAMILY_YEARLY
};

export function priceIdFor(planId: string, interval: "monthly" | "yearly"): string | undefined {
  return stripePriceIds[`${planId}:${interval}`];
}
