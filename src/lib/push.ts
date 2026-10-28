import "server-only";
import webpush from "web-push";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

let configured = false;

function configure(): boolean {
  if (configured) return true;
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(
    "mailto:bonjour@klerio.fr",
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );
  configured = true;
  return true;
}

export function pushConfigured(): boolean {
  return Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/** Envoie à tous les appareils d'un utilisateur. Supprime les abonnements expirés. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!configure()) return { sent: 0, failed: 0 };
  const subscriptions = await db.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  let failed = 0;
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth }
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          url: payload.url ?? "/app/reminders"
        })
      );
      sent += 1;
    } catch (error) {
      failed += 1;
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await db.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
      }
    }
  }
  return { sent, failed };
}
