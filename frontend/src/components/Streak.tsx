import type { Streak as StreakValue } from "../streak";

/** Flame and day count shown beside the Done heading. */
export default function Streak({ streak }: { streak: StreakValue }) {
  const { count, todayDone } = streak;
  const label = todayDone
    ? `${count}-day streak. All of today's tasks are done!`
    : count > 0
      ? `${count}-day streak. Finish all of today's tasks to keep it going.`
      : "No streak yet. Finish every task you set today to start one.";
  return (
    <span className={todayDone ? "streak" : "streak pending"} title={label} aria-label={label}>
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path
          d="M12 2C9 6 6 8.5 6 13.5a6 6 0 0 0 12 0c0-2.5-1-4.5-2.5-6 0 2-1 3.5-2.5 3.5 0-3.5-.5-6-1-9z"
          fill="currentColor"
        />
      </svg>
      {count}
    </span>
  );
}
