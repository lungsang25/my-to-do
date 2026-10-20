import { useEffect, useRef, useState } from "react";

const PRESETS = [5, 15, 25, 45];

interface Props {
  onStart: (seconds: number) => void;
  onClose: () => void;
}

/** Pick how long to count down: a preset or a custom number of minutes. */
export default function TimerModal({ onStart, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [custom, setCustom] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const minutes = Number(custom);
  const valid = Number.isInteger(minutes) && minutes >= 1 && minutes <= 999;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal timer-modal" role="dialog" aria-modal="true" aria-labelledby="timer-title">
        <div className="modal-header">
          <h2 id="timer-title">Timer</h2>
          <button ref={closeRef} type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="timer-presets">
          {PRESETS.map((m) => (
            <button key={m} type="button" className="timer-chip" onClick={() => onStart(m * 60)}>
              {m} min
            </button>
          ))}
        </div>
        <form
          className="timer-custom"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onStart(minutes * 60);
          }}
        >
          <input
            type="number"
            min={1}
            max={999}
            step={1}
            inputMode="numeric"
            placeholder="Custom minutes"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            aria-label="Custom minutes"
          />
          <button type="submit" className="new-button" disabled={!valid}>
            Start
          </button>
        </form>
      </div>
    </div>
  );
}
