import type { Status, Task } from "../api";
import { cap } from "../text";
import Bolt from "./Bolt";

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
  newDisabled?: boolean;
}

export default function Board({ tasks, onOpen, onShowResults, onDelete, onNew, newDisabled }: Props) {
  return (
    <section className="board" aria-label="Task board">
      <button type="button" className="new-button" onClick={onNew} disabled={newDisabled}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        New
      </button>
      {COLUMNS.map(({ status, label }) => (
        <div key={status} className="column">
          <h2 className="column-title">{label}</h2>
          <ul className="column-list">
            {tasks
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
