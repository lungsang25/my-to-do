import { useEffect, useRef } from "react";
import Bolt from "./Bolt";
import type { Task } from "../api";

interface Props {
  task: Task;
  onClose: () => void;
  onToggleStep: (stepId: number, done: boolean) => void;
}

export default function TaskModal({ task, onClose, onToggleStep }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <h2 id="modal-title">
            <Bolt size={22} />
            <span>{task.title}</span>
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {task.steps.length === 0 ? (
          <p className="muted">No steps yet.</p>
        ) : (
          <ul className="step-list">
            {task.steps.map((s) => (
              <li key={s.id}>
                <label className={s.done ? "step done" : "step"}>
                  <span className="step-text">
                    {s.text}
                    {s.done && (
                      <svg className="step-tick" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M7 12.5l3.2 3.2L17 8.8" pathLength="1" />
                      </svg>
                    )}
                  </span>
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={(e) => onToggleStep(s.id, e.target.checked)}
                  />
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
