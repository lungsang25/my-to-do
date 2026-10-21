import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { cap, toggleBold } from "../text";
import RichText from "./RichText";
import Bolt from "./Bolt";
import type { Step, Task } from "../api";

interface Props {
  task: Task;
  onClose: () => void;
  onToggleStep: (stepId: number, done: boolean) => void;
  onAddStep: (task: Task, text: string) => void;
  onReorder: (task: Task, stepIds: number[]) => void;
  onEditStep: (stepId: number, text: string) => void;
  onEditTitle: (taskId: number, title: string) => void;
}

export default function TaskModal({ task, onClose, onToggleStep, onAddStep, onReorder, onEditStep, onEditTitle }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  // The step whose text is being edited, with its draft (bold parts sit between ** markers).
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const editRef = useRef<HTMLTextAreaElement>(null);

  const [titleDraft, setTitleDraft] = useState<string | null>(null);

  const saveTitle = () => {
    const value = (titleDraft ?? "").trim();
    if (value && value !== cap(task.title)) onEditTitle(task.id, value);
    setTitleDraft(null);
  };

  const startEdit = (s: Step) => {
    setEditId(s.id);
    setDraft(s.text);
  };

  const bold = () => {
    const el = editRef.current;
    if (!el) return;
    const r = toggleBold(draft, el.selectionStart ?? 0, el.selectionEnd ?? 0);
    setDraft(r.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(r.start, r.end);
    });
  };

  // Grow the textarea to show the whole step.
  const fitEdit = (e: { currentTarget: HTMLTextAreaElement }) => {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + 2 + "px";
  };

  const saveEdit = () => {
    const value = draft.replace(/\*\*\*\*/g, "").trim();
    if (editId !== null && value && value !== task.steps.find((x) => x.id === editId)?.text) {
      onEditStep(editId, value);
    }
    setEditId(null);
  };
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Steps still being saved have placeholder (negative) ids and can't be moved yet.
  const canEdit = task.id > 0;
  const canMove = task.steps.every((s) => s.id > 0);

  // Drag to reorder: `from` is the dragged step's index, `over` where it would land.
  // Row midpoints are measured once when the drag starts so the preview can't flicker.
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);
  const rows = useRef<(HTMLLIElement | null)[]>([]);
  const mids = useRef<number[]>([]);

  const moved = (from: number, to: number): Step[] => {
    const list = [...task.steps];
    list.splice(to, 0, ...list.splice(from, 1));
    return list;
  };
  const shown = drag ? moved(drag.from, drag.over) : task.steps;

  const startDrag = (e: ReactPointerEvent<HTMLButtonElement>, index: number) => {
    if (!canMove || task.steps.length < 2) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    mids.current = task.steps.map((_, i) => {
      const r = rows.current[i]?.getBoundingClientRect();
      return r ? r.top + r.height / 2 : 0;
    });
    setDrag({ from: index, over: index });
  };

  const dragOver = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const over = mids.current.filter((m, i) => i !== drag.from && m < e.clientY).length;
    if (over !== drag.over) setDrag({ from: drag.from, over });
  };

  const endDrag = () => {
    if (drag && drag.from !== drag.over) {
      onReorder(task, moved(drag.from, drag.over).map((s) => s.id));
    }
    setDrag(null);
  };

  const addStep = () => {
    const value = text.trim();
    if (!value) return;
    setText("");
    onAddStep(task, value);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <h2 id="modal-title">
            <Bolt size={22} />
            {editing && titleDraft !== null ? (
              <form
                className="title-edit"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveTitle();
                }}
              >
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setTitleDraft(null);
                    }
                  }}
                  aria-label="Edit title"
                  autoComplete="off"
                  autoFocus
                />
                <button type="submit" className="step-save">
                  Save
                </button>
              </form>
            ) : (
              <>
                <span>{cap(task.title)}</span>
                {editing && (
                  <button
                    type="button"
                    className="edit-step"
                    onClick={() => setTitleDraft(cap(task.title))}
                    aria-label="Edit title"
                    title="Edit title"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                      <path
                        d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}
              </>
            )}
          </h2>
          {canEdit && (
            <button
              type="button"
              className={editing ? "edit-toggle active" : "edit-toggle"}
              onClick={() => {
                setEditing((v) => !v);
                setEditId(null);
                setTitleDraft(null);
              }}
              aria-pressed={editing}
            >
              {editing ? "Done" : "Edit"}
            </button>
          )}
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
        {task.steps.length === 0 && !editing ? (
          <p className="muted">No steps yet.</p>
        ) : (
          <ul className="step-list">
            {shown.map((s, i) => (
              <li
                key={s.id}
                ref={(el) => {
                  // Rows are indexed by their position before the drag started.
                  const original = task.steps.findIndex((x) => x.id === s.id);
                  rows.current[original] = el;
                }}
                className={
                  "step-item" + (editing ? " editing" : "") + (drag && i === drag.over ? " dragging" : "")
                }
              >
                {editing && editId === s.id ? (
                  <form
                    className="step-edit"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveEdit();
                    }}
                  >
                    <textarea
                      ref={editRef}
                      rows={3}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onFocus={fitEdit}
                      onInput={(e) => fitEdit(e)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          saveEdit();
                        } else if (e.key === "b" && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          bold();
                        } else if (e.key === "Escape") {
                          e.stopPropagation();
                          setEditId(null);
                        }
                      }}
                      aria-label="Edit step"
                      autoComplete="off"
                      autoFocus
                    />
                    <div className="step-edit-actions">
                    <button
                      type="button"
                      className="bold-button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={bold}
                      title="Bold the selected text (Ctrl+B)"
                      aria-label="Bold selected text"
                    >
                      B
                    </button>
                    <button type="submit" className="step-save">
                      Save
                    </button>
                    </div>
                  </form>
                ) : (
                  <>
                <label className={s.done ? "step done" : "step"}>
                  <span className="step-text">
                    <RichText text={s.text} />
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
                  </>
                )}
                {editing && editId !== s.id && (
                  <button
                    type="button"
                    className="edit-step"
                    onClick={() => startEdit(s)}
                    disabled={s.id < 0}
                    aria-label={`Edit "${s.text}"`}
                    title="Edit step"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                      <path
                        d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}
                {editing && (
                  <button
                    type="button"
                    className="drag-handle"
                    onPointerDown={(e) => startDrag(e, task.steps.findIndex((x) => x.id === s.id))}
                    onPointerMove={dragOver}
                    onPointerUp={endDrag}
                    onPointerCancel={() => setDrag(null)}
                    onKeyDown={(e) => {
                      const from = task.steps.findIndex((x) => x.id === s.id);
                      const to = from + (e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0);
                      if (to === from || to < 0 || to >= task.steps.length || !canMove) return;
                      e.preventDefault();
                      onReorder(task, moved(from, to).map((x) => x.id));
                    }}
                    disabled={!canMove || task.steps.length < 2}
                    aria-label={`Reorder "${s.text}" (drag, or use the arrow keys)`}
                    title="Drag to reorder"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                      <path
                        d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {editing && (
          <form
            className="add-step"
            onSubmit={(e) => {
              e.preventDefault();
              addStep();
            }}
          >
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a step…"
              aria-label="Add a step"
              autoComplete="off"
            />
            <button type="submit" disabled={!text.trim()}>
              Add
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
