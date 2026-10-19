import { useEffect, useRef } from "react";
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
          <h2 id="modal-title">{task.title}</h2>
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
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={(e) => onToggleStep(s.id, e.target.checked)}
                  />
                  <span>{s.text}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
