import type { Streak as StreakValue } from "../streak";
import { currentPeriodPossessive, periodName } from "../period";

/** Flame and streak count shown beside the Done heading. */
export default function Streak({ streak, duration }: { streak: StreakValue; duration: string }) {
  const { count, currentDone } = streak;
  const name = periodName(duration);
  const current = currentPeriodPossessive(duration);
  const label = currentDone
    ? `${count}-${name} streak. All of ${current} tasks are done!`
    : count > 0
      ? `${count}-${name} streak. Finish all of ${current} tasks to keep it going.`
      : `No streak yet. Finish every task you set ${current === "today's" ? "today" : `this ${name}`} to start one.`;
  return (
    <span className={currentDone ? "streak" : "streak pending"} title={label} aria-label={label}>
      <svg className="streak-flame" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
        <defs>
          <linearGradient id="streak-fire" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#e8310c" />
            <stop offset="0.55" stopColor="#ff7a18" />
            <stop offset="1" stopColor="#ffb02e" />
          </linearGradient>
        </defs>
        <path
          className="streak-flame-outer"
          d="M12 2C9 6 6 8.5 6 13.5a6 6 0 0 0 12 0c0-2.5-1-4.5-2.5-6 0 2-1 3.5-2.5 3.5 0-3.5-.5-6-1-9z"
        />
        <path className="streak-flame-core" d="M12 11c-1.5 2-3 3.2-3 5a3 3 0 0 0 6 0c0-1.8-1.5-3-3-5z" />
      </svg>
      {count}
    </span>
  );
}
