import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, ScanLine, ShieldCheck, Sparkles } from "lucide-react";
import { AppNav } from "./app-nav";
import { Logo } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import { Progress } from "./ui";
import { formatBytes } from "@/lib/quota/plans";
import { initials } from "@/lib/utils";

export function AppShell({
  children,
  user,
  planName,
  isFamily,
  storageUsed,
  storageLimit,
  scanRemaining,
  scanLimit,
  scanUnit,
  credits,
  unread,
  familyName
}: {
  children: ReactNode;
  user: { name: string | null; email: string };
  planName: string;
  isFamily: boolean;
  storageUsed: number;
  storageLimit: number;
  scanRemaining: number;
  scanLimit: number;
  scanUnit: string;
  credits: number;
  unread: number;
  familyName?: string | null;
}) {
  const storagePct = storageLimit > 0 ? (storageUsed / storageLimit) * 100 : 0;

  return (
    <div className="min-h-dvh">
      <a href="#contenu" className="skip-link">
        Aller au contenu
      </a>
      <div className="mx-auto flex w-full max-w-[1400px]">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-ink-200/80 bg-white/55 px-4 py-5 backdrop-blur lg:flex dark:border-ink-800 dark:bg-ink-950/50">
          <Link href="/app" className="mb-6 px-2" aria-label="Klerio, accueil">
            <Logo />
          </Link>
          <div className="mb-5 rounded-2xl border border-brand-200/70 bg-brand-50/80 p-3 text-xs dark:border-brand-800 dark:bg-brand-950/40">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-brand-900 dark:text-brand-100">{planName}</span>
              <Link href="/app/billing" className="link text-[0.7rem]">
                Gérer
              </Link>
            </div>
            <p className="mt-1 text-brand-800/80 dark:text-brand-200/80">
              {scanRemaining} {scanUnit}
              {scanRemaining > 1 ? "s" : ""} de scan restante{scanRemaining > 1 ? "s" : ""}
              {scanLimit > 0 ? ` sur ${scanLimit}` : ""}
            </p>
          </div>

          <AppNav isFamily={isFamily} variant="desktop" />

          <div className="mt-auto space-y-3 pt-5">
            <div className="rounded-2xl border border-ink-200 bg-white/80 p-3 dark:border-ink-800 dark:bg-ink-900/70">
              <div className="flex items-center justify-between text-[0.7rem] font-semibold text-ink-600 dark:text-ink-300">
                <span>Stockage</span>
                <span>
                  {formatBytes(storageUsed)} / {formatBytes(storageLimit)}
                </span>
              </div>
              <div className="mt-2">
                <Progress value={storagePct} tone={storagePct >= 90 ? "danger" : storagePct >= 80 ? "warning" : "brand"} label="Stockage utilisé" />
              </div>
              {isFamily && <p className="mt-2 text-[0.7rem] text-ink-500 dark:text-ink-400">Pool famille partagé</p>}
            </div>
            <p className="flex items-start gap-1.5 px-1 text-[0.68rem] leading-relaxed text-ink-500 dark:text-ink-400">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Chiffré, hébergé en UE. L'IA ne sert jamais à entraîner un modèle.
            </p>
          </div>
        </aside>

        <div className="min-w-0 flex-1 pb-24 lg:pb-0">
          <header className="sticky top-0 z-30 border-b border-ink-200/70 bg-[#f6f4ee]/90 backdrop-blur dark:border-ink-800 dark:bg-ink-950/85">
            <div className="flex min-h-[64px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3 lg:hidden">
                <Link href="/app" aria-label="Klerio, accueil">
                  <Logo compact />
                </Link>
                {familyName && (
                  <span className="hidden text-xs font-semibold text-ink-500 sm:inline dark:text-ink-400">{familyName}</span>
                )}
              </div>
              <div className="hidden min-w-0 items-center gap-2 lg:flex">
                <p className="truncate text-sm text-ink-500 dark:text-ink-400">
                  Bonjour <span className="font-semibold text-ink-900 dark:text-white">{user.name ?? user.email}</span>
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="hidden items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3 py-1.5 text-xs font-semibold text-accent-800 sm:inline-flex dark:border-accent-800 dark:bg-accent-950/40 dark:text-accent-200">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  {credits} crédits
                </span>
                <Link href="/app/scan" className="btn-primary hidden sm:inline-flex">
                  <ScanLine className="h-4 w-4" aria-hidden="true" />
                  Scanner
                </Link>
                <Link
                  href="/app/reminders"
                  className="btn-ghost relative h-11 w-11 p-0"
                  aria-label={`Rappels${unread > 0 ? `, ${unread} notifications non lues` : ""}`}
                >
                  <Bell className="h-5 w-5" aria-hidden="true" />
                  {unread > 0 && (
                    <span className="absolute right-1.5 top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent-500 px-1 text-[0.6rem] font-bold text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Link>
                <ThemeToggle />
                <Link
                  href="/app/account"
                  className="grid h-10 w-10 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white dark:bg-brand-400 dark:text-ink-950"
                  aria-label={`Mon compte — ${initials(user.name, user.email)}`}
                >
                  {initials(user.name, user.email)}
                </Link>
              </div>
            </div>
          </header>

          <main id="contenu" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            {children}
          </main>
        </div>
      </div>
      <AppNav isFamily={isFamily} variant="mobile" />
    </div>
  );
}
