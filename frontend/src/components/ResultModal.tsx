import { useEffect, useRef } from "react";
import { cap } from "../text";
import Bolt from "./Bolt";
import type { Task } from "../api";

interface Props {
  task: Task;
  onClose: () => void;
}

/** The results the user imagined for a task, shown as motivation. */
export default function ResultModal({ task, onClose }: Props) {
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
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="result-title">
        <div className="modal-header">
          <h2 id="result-title">
            <Bolt size={22} />
            <span>{cap(task.title)}</span>
          </h2>
          <button ref={closeRef} type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <p className="result-heading">When this is done…</p>
        <ul className="result-list">
          {task.results.map((r) => (
            <li key={r.id}>{cap(r.text)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
