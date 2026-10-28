/**
 * Calcul des fenêtres de quota, dans le fuseau Europe/Paris.
 *
 * Règles affichées à l'utilisateur :
 * - mensuel : le jour anniversaire de l'abonnement, à 00h00 (Paris) ;
 * - hebdomadaire : chaque lundi à 00h00 (Paris) ;
 * - à vie : jamais réinitialisé.
 *
 * Le calcul est volontairement sans dépendance externe et testé.
 */

import type { Periodicity } from "./plans";

export const PARIS_TZ = "Europe/Paris";
export const LIFETIME_END = new Date("9999-12-31T23:59:59.000Z");

export interface PeriodWindow {
  key: string;
  start: Date;
  end: Date;
  periodicity: Periodicity;
}

interface TzParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = FORMATTERS.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    FORMATTERS.set(tz, f);
  }
  return f;
}

export function partsInTimeZone(date: Date, tz = PARIS_TZ): TzParts {
  const parts = formatter(tz).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const hour = get("hour") === 24 ? 0 : get("hour");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
    second: get("second")
  };
}

/** Décalage (ms) entre l'heure locale du fuseau et UTC, à l'instant donné. */
function offsetMs(date: Date, tz: string): number {
  const p = partsInTimeZone(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Construit un instant UTC à partir d'une date/heure « murale » dans le fuseau. */
export function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  tz = PARIS_TZ
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = offsetMs(new Date(guess), tz);
  return new Date(guess - offset);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month));
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Numéro de semaine ISO 8601 d'une date calendaire (année, mois, jour). */
export function isoWeek(year: number, month: number, day: number): { year: number; week: number } {
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayNum = date.getUTCDay() || 7; // lundi = 1
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: isoYear, week };
}

export function monthlyWindow(now: Date, anchorDay: number, tz = PARIS_TZ): PeriodWindow {
  const p = partsInTimeZone(now, tz);
  const anchor = Math.min(Math.max(anchorDay || 1, 1), 31);
  const dayThisMonth = clampDay(p.year, p.month, anchor || 1);
  const startThisMonth = zonedDateTimeToUtc(p.year, p.month, dayThisMonth, 0, 0, 0, tz);

  let start: Date;
  let end: Date;
  let keyYear = p.year;
  let keyMonth = p.month;

  if (now.getTime() >= startThisMonth.getTime()) {
    start = startThisMonth;
    const nextMonth = p.month === 12 ? 1 : p.month + 1;
    const nextYear = p.month === 12 ? p.year + 1 : p.year;
    end = zonedDateTimeToUtc(nextYear, nextMonth, clampDay(nextYear, nextMonth, anchor || 1), 0, 0, 0, tz);
  } else {
    const prevMonth = p.month === 1 ? 12 : p.month - 1;
    const prevYear = p.month === 1 ? p.year - 1 : p.year;
    start = zonedDateTimeToUtc(prevYear, prevMonth, clampDay(prevYear, prevMonth, anchor || 1), 0, 0, 0, tz);
    end = startThisMonth;
    keyYear = prevYear;
    keyMonth = prevMonth;
  }

  return {
    key: `${keyYear}-${pad(keyMonth)}`,
    start,
    end,
    periodicity: "monthly"
  };
}

export function weeklyWindow(now: Date, tz = PARIS_TZ): PeriodWindow {
  const p = partsInTimeZone(now, tz);
  const calendar = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const dow = calendar.getUTCDay(); // 0 = dimanche
  const sinceMonday = (dow + 6) % 7;
  calendar.setUTCDate(calendar.getUTCDate() - sinceMonday);
  const y = calendar.getUTCFullYear();
  const m = calendar.getUTCMonth() + 1;
  const d = calendar.getUTCDate();
  const start = zonedDateTimeToUtc(y, m, d, 0, 0, 0, tz);
  const end = new Date(start.getTime() + 7 * 86400000);
  const { year, week } = isoWeek(y, m, d);
  return {
    key: `${year}-W${pad(week)}`,
    start,
    end,
    periodicity: "weekly"
  };
}

export function lifetimeWindow(): PeriodWindow {
  return {
    key: "lifetime",
    start: new Date("2000-01-01T00:00:00.000Z"),
    end: LIFETIME_END,
    periodicity: "lifetime"
  };
}

export function windowFor(periodicity: Periodicity, now: Date, anchorDay: number, tz = PARIS_TZ): PeriodWindow {
  switch (periodicity) {
    case "lifetime":
      return lifetimeWindow();
    case "weekly":
      return weeklyWindow(now, tz);
    case "monthly":
    default:
      return monthlyWindow(now, anchorDay, tz);
  }
}

export function nextWeeklyReset(now: Date = new Date(), tz = PARIS_TZ): Date {
  return weeklyWindow(now, tz).end;
}

export function formatParisDate(date: Date, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
    ...opts
  }).format(date);
}

export function formatParisDateTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatReset(date: Date | null | undefined, now: Date = new Date()): string {
  if (!date) return "—";
  if (date.getTime() >= LIFETIME_END.getTime() - 86400000) return "jamais";
  const days = Math.max(0, Math.ceil((date.getTime() - now.getTime()) / 86400000));
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "demain";
  return `le ${formatParisDate(date)}`;
}
