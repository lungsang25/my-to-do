import { useEffect, useState } from "react";
import { alertTimerDone } from "../timerAlerts";

interface Props {
  endsAt: number; // epoch ms
  onCancel: () => void;
}

function format(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Countdown pinned to the bottom centre of the screen. */
export default function TimerDock({ endsAt, onCancel }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const remaining = endsAt - now;
  const finished = remaining <= 0;

  // Compare against the clock (not a decrementing counter) so a throttled background tab stays right.
  useEffect(() => {
    if (finished) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [finished]);

  useEffect(() => {
    if (!finished) return;
    // A timer that ended while the page was closed shouldn't alert on reload.
    if (Date.now() - endsAt < 5000) alertTimerDone();
  }, [finished, endsAt]);

  useEffect(() => {
    const original = document.title;
    document.title = finished ? "Time's up!" : `${format(remaining)} · ${original}`;
    return () => {
      document.title = original;
    };
  }, [finished, remaining]);

  return (
    <div className={finished ? "timer-dock is-finished" : "timer-dock"} role="timer" aria-live="off">
      <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" className="timer-dock-icon">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2M9 2h6" />
      </svg>
      <span className="timer-dock-time">{finished ? "Time's up" : format(remaining)}</span>
      <button
        type="button"
        className="icon-button"
        onClick={onCancel}
        aria-label={finished ? "Dismiss timer" : "Cancel timer"}
        title={finished ? "Dismiss" : "Cancel"}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
