/**
 * Durations are keys like "1d", "2w", "1m", "1y": a count (1-999) and a unit.
 * Periods start at local midnight on the duration's anchor date (the day it was
 * first chosen) and repeat every duration from there.
 */

export type Unit = "d" | "w" | "m" | "y";

const UNIT_WORDS: Record<Unit, string> = { d: "day", w: "week", m: "month", y: "year" };

export function parseDuration(key: string): { n: number; unit: Unit } {
  const match = /^([1-9]\d{0,2})([dwmy])$/.exec(key);
  if (!match) return { n: 1, unit: "d" };
  return { n: Number(match[1]), unit: match[2] as Unit };
}

/** Rough length in days, for sorting durations shortest first. */
export function approxDays(key: string): number {
  const { n, unit } = parseDuration(key);
  return n * { d: 1, w: 7, m: 30.4, y: 365 }[unit];
}

/** "1 day", "2 weeks", "1 month". */
export function durationLabel(key: string): string {
  const { n, unit } = parseDuration(key);
  return `${n} ${UNIT_WORDS[unit]}${n === 1 ? "" : "s"}`;
}

/** What one period is called: "day", "week", "2-week period". */
export function periodName(key: string): string {
  const { n, unit } = parseDuration(key);
  return n === 1 ? UNIT_WORDS[unit] : `${n}-${UNIT_WORDS[unit]} period`;
}

/** "today's", "this week's", "this 2-week period's". */
export function currentPeriodPossessive(key: string): string {
  return key === "1d" ? "today's" : `this ${periodName(key)}'s`;
}

/** Whole local calendar days since an arbitrary epoch (ignores DST hour shifts). */
function dayNumber(y: number, m: number, d: number): number {
  return Math.round(Date.UTC(y, m, d) / 86_400_000);
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

/** Which period (0 = the one starting on the anchor, negative = before it) a moment falls in. */
export function periodIndex(date: Date, key: string, anchor: string): number {
  const { n, unit } = parseDuration(key);
  const [ay, am, ad] = anchor.split("-").map(Number);
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();

  if (unit === "d" || unit === "w") {
    const length = unit === "w" ? n * 7 : n;
    return Math.floor((dayNumber(y, m, d) - dayNumber(ay, am - 1, ad)) / length);
  }

  // Months since the anchor that have fully started. An anchor on the 31st starts
  // shorter months on their last day.
  let months = (y - ay) * 12 + (m - (am - 1));
  if (d < Math.min(ad, daysInMonth(y, m))) months -= 1;
  const length = unit === "y" ? n * 12 : n;
  return Math.floor(months / length);
}
