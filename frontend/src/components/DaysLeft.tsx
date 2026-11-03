import { daysLeftLabel } from "../period";

/** Reminder chip for tasks under long durations; turns urgent in the last 3 days. */
export default function DaysLeft({ days }: { days: number }) {
  const urgent = days <= 3;
  return (
    <span
      className={urgent ? "days-left urgent" : "days-left"}
      title={days > 0 ? "Days left to finish this task" : "This task is past its deadline"}
    >
      <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
        <path
          d="M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2M9 2h6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {daysLeftLabel(days)}
    </span>
  );
}
