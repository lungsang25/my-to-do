import { useEffect, useRef, useState } from "react";
import { durationLabel, type Unit } from "../period";

const UNITS: { unit: Unit; label: string }[] = [
  { unit: "d", label: "days" },
  { unit: "w", label: "weeks" },
  { unit: "m", label: "months" },
  { unit: "y", label: "years" },
];

interface Props {
  active: string;
  /** Durations the user has used before, shortest first. Empty on first use. */
  options: string[];
  /** Streak count for each duration that has been used. */
  streaks: Record<string, number>;
  onChoose: (key: string) => void;
  onClose: () => void;
}

/** Pick the period the streak and Done list are measured over. */
export default function DurationModal({ active, options, streaks, onChoose, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<Unit>("d");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const n = Number(amount);
  const valid = Number.isInteger(n) && n >= 1 && n <= 999;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal timer-modal" role="dialog" aria-modal="true" aria-labelledby="duration-title">
        <div className="modal-header">
          <h2 id="duration-title">Duration</h2>
          <button ref={closeRef} type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <p className="duration-help">
          Finish every task you create within each period to grow its streak. Each duration keeps its own
          streak.
        </p>
        {options.length === 0 ? (
          <p className="duration-current">No durations set yet. Set your first one below.</p>
        ) : (
          <div className="duration-presets">
            {options.map((key) => (
              <button
                key={key}
                type="button"
                className={key === active ? "timer-chip is-active" : "timer-chip"}
                aria-pressed={key === active}
                onClick={() => onChoose(key)}
              >
                {durationLabel(key)}
                <small>🔥 {streaks[key] ?? 0}</small>
              </button>
            ))}
          </div>
        )}
        <form
          className="timer-custom"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onChoose(`${n}${unit}`);
          }}
        >
          <input
            type="number"
            min={1}
            max={999}
            step={1}
            inputMode="numeric"
            placeholder="e.g. 3"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Custom length"
          />
          <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)} aria-label="Unit">
            {UNITS.map((u) => (
              <option key={u.unit} value={u.unit}>
                {u.label}
              </option>
            ))}
          </select>
          <button type="submit" className="new-button" disabled={!valid}>
            Set
          </button>
        </form>
      </div>
    </div>
  );
}
