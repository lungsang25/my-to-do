import type { Status, Task } from "../api";
import { cap } from "../text";
import type { Streak as StreakValue } from "../streak";
import { durationLabel } from "../period";
import Bolt from "./Bolt";
import Streak from "./Streak";

const COLUMNS: { status: Status; label: string }[] = [
  { status: "todo", label: "To Do" },
  { status: "done", label: "Done" },
];

interface Props {
  tasks: Task[];
  onOpen: (task: Task) => void;
  onShowResults: (task: Task) => void;
  onDelete: (task: Task) => void;
  onNew: () => void;
  onShowHistory: () => void;
  onShowTimer: () => void;
  onShowDuration: () => void;
  newDisabled?: boolean;
  streak: StreakValue;
  /** Active duration key, e.g. "1w". */
  duration: string;
  /** False for done tasks whose period is over; those live in History. */
  isCurrent: (task: Task) => boolean;
}

export default function Board({
  tasks,
  onOpen,
  onShowResults,
  onDelete,
  onNew,
  onShowHistory,
  onShowTimer,
  onShowDuration,
  newDisabled,
  streak,
  duration,
  isCurrent,
}: Props) {
  return (
    <section className="board" aria-label="Task board">
      <div className="board-actions">
        <button type="button" className="new-button duration-button" onClick={onShowDuration}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path
              d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 3v4M16 3v4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="duration-text">
            Duration
            <small>{durationLabel(duration)}</small>
          </span>
        </button>
        <button type="button" className="new-button" onClick={onNew} disabled={newDisabled}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          New
        </button>
        <button type="button" className="new-button" onClick={onShowHistory}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path
              d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          History
        </button>
        <button type="button" className="new-button" onClick={onShowTimer}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path
              d="M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2M9 2h6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Timer
        </button>
      </div>
      {COLUMNS.map(({ status, label }) => (
        <div key={status} className="column">
          <h2 className={`column-title column-title-${status}`}>
            <span className="column-label">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                {status === "done" ? (
                  <>
                    <circle cx="12" cy="12" r="9" />
                    <path d="m8 12.5 2.8 2.8L16 9.8" />
                  </>
                ) : (
                  <>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </>
                )}
              </svg>
              {label}
            </span>
            {status === "done" && <Streak streak={streak} duration={duration} />}
          </h2>
          <ul className="column-list">
            {tasks
              .filter(isCurrent)
              .filter((t) => (t.status === "done" ? "done" : "todo") === status)
              .map((t) => {
                const done = t.steps.filter((s) => s.done).length;
                return (
                  <li key={t.id} className="task-row">
                    <button type="button" className="task-item" onClick={() => onOpen(t)}>
                      <span className="task-title">
                        <Bolt size={16} />
                        {cap(t.title)}
                      </span>
                    </button>
                    {t.results.length > 0 && (
                      <button type="button" className="result-chip" onClick={() => onShowResults(t)}>
                        Result
                      </button>
                    )}
                    {t.steps.length > 0 && (
                      <span className="task-progress">
                        {done}/{t.steps.length}
                      </span>
                    )}
                    <button
                      type="button"
                      className="icon-button task-delete"
                      onClick={() => onDelete(t)}
                      aria-label={`Delete "${t.title}"`}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                        <path
                          d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </section>
  );
}
