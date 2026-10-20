import type { Task } from "./api";

export interface Streak {
  /** Days in a row (skipping days with no tasks) where every task was finished the same day. */
  count: number;
  /** Today's tasks exist and are all finished, so today already counts. */
  todayDone: boolean;
}

/** The server stores times as UTC "YYYY-MM-DD HH:MM:SS". */
function parseUtc(value: string): Date {
  return new Date(value.replace(" ", "T") + "Z");
}

/** Local calendar day, so the streak follows the user's own midnight. */
function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function computeStreak(tasks: Task[], now = new Date()): Streak {
  const today = dayKey(now);
  const byDay = new Map<string, Task[]>();
  for (const t of tasks) {
    // Drafts not yet saved have no created_at; they were made just now.
    const day = t.created_at ? dayKey(parseUtc(t.created_at)) : today;
    byDay.set(day, [...(byDay.get(day) ?? []), t]);
  }

  const won = (day: string) =>
    byDay
      .get(day)!
      .every(
        (t) => t.status === "done" && t.completed_at !== null && dayKey(parseUtc(t.completed_at)) === day,
      );

  const todayDone = byDay.has(today) && won(today);
  let count = todayDone ? 1 : 0;
  // Today still in progress doesn't break the streak; past days do.
  const pastDays = [...byDay.keys()].filter((d) => d < today).sort().reverse();
  for (const day of pastDays) {
    if (!won(day)) break;
    count++;
  }
  return { count, todayDone };
}

/** Current time in the server's format, for optimistic updates. */
export function nowUtc(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}
