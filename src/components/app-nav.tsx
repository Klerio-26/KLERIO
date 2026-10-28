"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  CreditCard,
  FolderLock,
  Home,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Users,
  UserRound
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/app", label: "Accueil", icon: Home, exact: true },
  { href: "/app/scan", label: "Scanner", icon: ScanLine },
  { href: "/app/vault", label: "Coffre-fort", icon: FolderLock },
  { href: "/app/assistant", label: "Assistant", icon: Sparkles },
  { href: "/app/official-links", label: "Liens officiels", icon: ShieldCheck },
  { href: "/app/reminders", label: "Rappels", icon: Bell },
  { href: "/app/family", label: "Famille", icon: Users },
  { href: "/app/quota", label: "Mes quotas", icon: BookOpen },
  { href: "/app/billing", label: "Forfait et crédits", icon: CreditCard },
  { href: "/app/account", label: "Mon compte", icon: UserRound }
];

export function AppNav({ isFamily, variant = "desktop" }: { isFamily: boolean; variant?: "desktop" | "mobile" }) {
  const pathname = usePathname();
  const visible = items.filter((item) => item.href !== "/app/family" || isFamily);

  if (variant === "desktop") {
    return (
      <nav aria-label="Navigation principale" className="hidden lg:block">
        <ul className="space-y-1">
          {visible.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
                    active
                      ? "bg-brand-700 text-white shadow-sm dark:bg-brand-500 dark:text-ink-950"
                      : "text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
      <nav
        aria-label="Navigation rapide"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden dark:border-ink-800 dark:bg-ink-950/95"
      >
        <ul className="grid grid-cols-5">
          {[
            items[0], // Accueil
            items[2], // Coffre-fort
            items[1], // Scanner
            items[3], // Assistant
            items.find((item) => item.href === "/app/reminders")!
          ].map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            const central = item.href === "/app/scan";
            return (
              <li key={item.href} className="flex justify-center">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-[58px] w-full flex-col items-center justify-center gap-0.5 text-[0.68rem] font-semibold",
                    active ? "text-brand-700 dark:text-brand-300" : "text-ink-500 dark:text-ink-400"
                  )}
                >
                  <span
                    className={cn(
                      "grid place-items-center rounded-xl",
                      central
                        ? "h-10 w-12 bg-brand-700 text-white shadow-float dark:bg-brand-500 dark:text-ink-950"
                        : "h-7 w-9"
                    )}
                  >
                    <Icon className={central ? "h-6 w-6" : "h-5 w-5"} aria-hidden="true" />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
  );
}
