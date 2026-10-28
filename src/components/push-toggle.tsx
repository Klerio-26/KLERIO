"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output.buffer;
}

export function PushToggle({ publicKey, configured }: { publicKey: string; configured: boolean }) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const ok = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
    if (!ok) {
      setSupported(false);
      return;
    }
    navigator.serviceWorker
      .getRegistration()
      .then((registration) => {
        if (!registration) {
          setSupported(false);
          return;
        }
        setSupported(true);
        return registration.pushManager.getSubscription().then((subscription) => setSubscribed(Boolean(subscription)));
      })
      .catch(() => setSupported(false));
  }, []);

  async function enable() {
    setBusy(true);
    setMessage(null);
    try {
      if (!configured) {
        setMessage("Les notifications push ne sont pas configurées sur ce serveur.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("Permission refusée. Vous pouvez l'autoriser dans les réglages du navigateur.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(publicKey)
      });
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON())
      });
      if (!response.ok) throw new Error("Enregistrement impossible.");
      setSubscribed(true);
      setMessage("Notifications push activées sur cet appareil.");
    } catch {
      setMessage("Impossible d'activer les notifications sur cet appareil.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      setMessage("Notifications push désactivées sur cet appareil.");
    } catch {
      setMessage("Désactivation impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <p className="text-xs text-ink-500 dark:text-ink-400">
        Les notifications push nécessitent un navigateur compatible et une installation en HTTPS. Les rappels in-app et
        e-mail restent disponibles.
      </p>
    );
  }

  return (
    <div>
      <button type="button" className={subscribed ? "btn-secondary text-xs" : "btn-primary text-xs"} onClick={subscribed ? disable : enable} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <BellRing className="h-4 w-4" aria-hidden="true" />}
        {busy ? "Traitement…" : subscribed ? "Désactiver les notifications push" : "Activer les notifications push"}
      </button>
      {message && <p className="mt-1 text-xs text-ink-600 dark:text-ink-300">{message}</p>}
    </div>
  );
}
