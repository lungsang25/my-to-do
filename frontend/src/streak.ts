import type { Task } from "./api";
import { periodIndex } from "./period";

export interface Streak {
  /** Periods in a row (skipping ones with no tasks) where every task was finished within its period. */
  count: number;
  /** The current period has tasks and they're all finished, so it already counts. */
  currentDone: boolean;
}

/** The server stores times as UTC "YYYY-MM-DD HH:MM:SS". */
export function parseUtc(value: string): Date {
  return new Date(value.replace(" ", "T") + "Z");
}

/** Local calendar day, so periods follow the user's own midnight. */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Streak for one duration. Only tasks created under that duration count, so every
 * duration keeps its own independent streak.
 */
export function computeStreak(tasks: Task[], key: string, anchor: string, now = new Date()): Streak {
  const current = periodIndex(now, key, anchor);
  const byPeriod = new Map<number, Task[]>();
  for (const t of tasks) {
    if (t.duration !== key) continue;
    // Drafts not yet saved have no created_at; they were made just now.
    const p = t.created_at ? periodIndex(parseUtc(t.created_at), key, anchor) : current;
    byPeriod.set(p, [...(byPeriod.get(p) ?? []), t]);
  }

  const won = (p: number) =>
    byPeriod
      .get(p)!
      .every(
        (t) =>
          t.status === "done" &&
          t.completed_at !== null &&
          periodIndex(parseUtc(t.completed_at), key, anchor) === p,
      );

  const currentDone = byPeriod.has(current) && won(current);
  let count = currentDone ? 1 : 0;
  // The current period still in progress doesn't break the streak; past ones do.
  const past = [...byPeriod.keys()].filter((p) => p < current).sort((a, b) => b - a);
  for (const p of past) {
    if (!won(p)) break;
    count++;
  }
  return { count, currentDone };
}

/** Current time in the server's format, for optimistic updates. */
export function nowUtc(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}
