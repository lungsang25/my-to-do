import RichText from "./RichText";
import { useEffect, useMemo, useRef } from "react";
import { cap } from "../text";
import { dayKey, parseUtc } from "../streak";
import Bolt from "./Bolt";
import type { Task } from "../api";

interface Props {
  tasks: Task[];
  /** Active duration, e.g. "1 week"; History only lists that duration's tasks. */
  durationLabel: string;
  onClose: () => void;
}

function dayLabel(key: string, now = new Date()): string {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (key === dayKey(now)) return "Today";
  if (key === dayKey(yesterday)) return "Yesterday";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Every finished task, newest first, grouped by the day it was finished. */
export default function HistoryModal({ tasks, durationLabel, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const days = useMemo(() => {
    const finished = tasks
      .filter((t) => t.status === "done" && t.completed_at)
      .map((t) => ({ task: t, at: parseUtc(t.completed_at!) }))
      .sort((a, b) => b.at.getTime() - a.at.getTime());
    const groups = new Map<string, typeof finished>();
    for (const item of finished) {
      const key = dayKey(item.at);
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups];
  }, [tasks]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="history-title">
        <div className="modal-header">
          <h2 id="history-title">
            History <span className="history-duration">· {durationLabel}</span>
          </h2>
          <button ref={closeRef} type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {days.length === 0 ? (
          <p className="result-heading">Nothing completed yet.</p>
        ) : (
          days.map(([key, items]) => (
            <section key={key} className="history-day">
              <h3 className="history-date">
                {dayLabel(key)}
                <span className="history-stamp-label">Done at</span>
              </h3>
              <ul className="history-list">
                {items.map(({ task, at }) => (
                  <li key={task.id}>
                    <details className="history-task">
                      <summary>
                        <span className="task-title">
                          <Bolt size={16} />
                          {cap(task.title)}
                        </span>
                        <time className="history-time" dateTime={at.toISOString()}>
                          {at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true })}
                        </time>
                      </summary>
                      <ul className="history-steps">
                        {task.steps.map((s) => (
                          <li key={s.id} className={s.done ? "is-done" : undefined}>
                            <RichText text={s.text} />
                          </li>
                        ))}
                        {task.steps.length === 0 && <li>No steps.</li>}
                      </ul>
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
