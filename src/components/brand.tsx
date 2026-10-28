import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-700 text-white shadow-sm dark:bg-brand-500 dark:text-ink-950">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
          <path d="M6 3.75h8.2L18.5 8v12.25H6V3.75Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M13.75 3.9V8.4h4.4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M8.7 12h6.6M8.7 15.2h4.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="16.4" cy="16.9" r="2.1" fill="currentColor" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[1.35rem] font-black tracking-tight text-ink-900 dark:text-white">Klerio</span>
          <span className="block whitespace-nowrap text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-brand-700 dark:text-brand-300">
            La paperasse, en clair
          </span>
        </span>
      )}
    </span>
  );
}

export function TrustLine({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400", className)}>
      <ShieldCheck className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
      Hébergement UE · chiffrement renforcé · aucune donnée utilisée pour entraîner l'IA
    </p>
  );
}
