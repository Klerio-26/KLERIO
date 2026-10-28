import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("card p-5 sm:p-6", className)}>{children}</div>;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="section-title mb-1">{eyebrow}</p>}
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-500 dark:text-ink-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  const tones = {
    neutral: "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200",
    brand: "bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200",
    success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
    warning: "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100",
    danger: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-100",
    info: "bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100"
  };
  return <span className={cn("badge", tones[tone], className)}>{children}</span>;
}

export function Progress({
  value,
  tone = "brand",
  label
}: {
  value: number;
  tone?: "brand" | "warning" | "danger";
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const colors = {
    brand: "bg-brand-600 dark:bg-brand-400",
    warning: "bg-amber-500",
    danger: "bg-red-500"
  };
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label ?? "Progression"}
    >
      <div className={cn("h-full rounded-full transition-all", colors[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "brand"
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: "brand" | "amber" | "sky" | "violet";
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200",
    amber: "bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100",
    sky: "bg-sky-50 text-sky-900 dark:bg-sky-900/30 dark:text-sky-100",
    violet: "bg-violet-50 text-violet-900 dark:bg-violet-900/30 dark:text-violet-100"
  };
  return (
    <div className="card-flat p-4">
      <div className="flex items-start gap-3">
        {icon && <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", tones[tone])}>{icon}</span>}
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">{label}</p>
          <p className="mt-1 truncate text-lg font-bold">{value}</p>
          {hint && <p className="mt-0.5 truncate text-xs text-ink-500 dark:text-ink-400">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-300 px-6 py-10 text-center dark:border-ink-700">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-500 dark:text-ink-400">{description}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Alert({
  children,
  tone = "info",
  title
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "danger" | "success";
  title?: string;
}) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100",
    warning: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
    danger: "border-red-200 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100",
    success: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
  };
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm leading-relaxed", tones[tone])} role="status">
      {title && <p className="mb-0.5 font-bold">{title}</p>}
      {children}
    </div>
  );
}
