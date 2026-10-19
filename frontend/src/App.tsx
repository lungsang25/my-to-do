import { useCallback, useEffect, useState } from "react";
import { cap } from "./text";
import { api, type Task } from "./api";
import { useTheme } from "./theme";
import ThemeToggle from "./components/ThemeToggle";
import PromptInput from "./components/PromptInput";
import StepsEntry from "./components/StepsEntry";
import Board from "./components/Board";
import ResultModal from "./components/ResultModal";
import TaskModal from "./components/TaskModal";

export default function App() {
  const { theme, toggle } = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  // The task whose steps are being entered; `created` resolves once the server has saved it.
  const [currentTask, setCurrentTask] = useState<{ title: string; created: Promise<Task> } | null>(
    null,
  );
  const [showPrompt, setShowPrompt] = useState(false);
  const [priority, setPriority] = useState("");
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [resultTaskId, setResultTaskId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<Task[] | null> => {
    try {
      const list = await api.listTasks();
      setTasks(list);
      setError(null);
      return list;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    // First visit (no tasks yet): start with the field. Otherwise show just the board.
    refresh().then((list) => setShowPrompt(!list || list.length === 0));
  }, [refresh]);

  const submitPriority = () => {
    // Move straight on to the steps; the task is created in the background.
    const title = priority.trim();
    const created = api.createTask(title);
    created.catch((e) => {
      setError((e as Error).message);
      setCurrentTask(null);
      setPriority(title); // let them try again without retyping
    });
    setCurrentTask({ title, created });
    setPriority("");
    setError(null);
  };

  const finishSteps = (draft: Task, saved: Promise<void>) => {
    setCurrentTask(null);
    setShowPrompt(false);
    setTasks((prev) => [...prev, draft]); // optimistic
    saved.then(() => refresh()); // swap in the server's copy, with real ids
  };

  const toggleStep = async (stepId: number, done: boolean) => {
    if (stepId < 0) return; // not saved yet; real ids arrive with the next refresh
    // Mirrors the backend rule: a task is Done once every step is checked.
    const setDone = (value: boolean) =>
      setTasks((prev) =>
        prev.map((t) => {
          if (!t.steps.some((s) => s.id === stepId)) return t;
          const steps = t.steps.map((s) => (s.id === stepId ? { ...s, done: value } : s));
          return { ...t, steps, status: steps.every((s) => s.done) ? "done" : "todo" };
        }),
      );
    setDone(done); // optimistic
    try {
      await api.setStepDone(stepId, done);
    } catch (e) {
      setDone(!done);
      setError((e as Error).message);
    }
  };

  const addStep = async (task: Task, text: string) => {
    if (task.id < 0) return; // not saved yet
    const temp = { id: -Date.now(), task_id: task.id, text, position: task.steps.length, done: false };
    // Optimistic: a new unchecked step also sends a finished task back to To Do.
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, steps: [...t.steps, temp], status: "todo" } : t)),
    );
    try {
      await api.addStep(task.id, text);
    } catch (e) {
      setError((e as Error).message);
    }
    await refresh(); // real ids (and the server's view if the save failed)
  };

  const reorderSteps = async (task: Task, stepIds: number[]) => {
    if (task.id < 0 || stepIds.some((id) => id < 0)) return;
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== task.id) return t;
        const byId = new Map(t.steps.map((s) => [s.id, s]));
        return { ...t, steps: stepIds.map((id, i) => ({ ...byId.get(id)!, position: i })) };
      }),
    );
    try {
      await api.reorderSteps(task.id, stepIds);
    } catch (e) {
      setError((e as Error).message);
      await refresh();
    }
  };

  const deleteTask = async (task: Task) => {
    if (task.id < 0) return; // not saved yet; real ids arrive with the next refresh
    if (!window.confirm(`Delete "${cap(task.title)}"?`)) return;
    const remaining = tasks.filter((t) => t.id !== task.id);
    setTasks(remaining); // optimistic
    if (openTaskId === task.id) setOpenTaskId(null);
    if (resultTaskId === task.id) setResultTaskId(null);
    if (remaining.length === 0) setShowPrompt(true); // board disappears; match first visit
    try {
      await api.deleteTask(task.id);
    } catch (e) {
      setError((e as Error).message);
      await refresh(); // restore the server's state
    }
  };

  const closeModal = useCallback(() => setOpenTaskId(null), []);
  const closeResults = useCallback(() => setResultTaskId(null), []);
  const resultTask = tasks.find((t) => t.id === resultTaskId) ?? null;
  const openTask = tasks.find((t) => t.id === openTaskId) ?? null;
  const showBoard = tasks.length > 0;
  // While adding a task, show only the field (the board returns when it's done or closed).
  const entering = showPrompt || currentTask !== null;

  return (
    <>
      <ThemeToggle theme={theme} onToggle={toggle} />

      <main className={showBoard && !entering ? "layout with-board" : "layout"}>
        {showBoard && !entering && (
          <Board
            tasks={tasks}
            onOpen={(t) => setOpenTaskId(t.id)}
            onShowResults={(t) => setResultTaskId(t.id)}
            onDelete={deleteTask}
            onNew={() => setShowPrompt(true)}
            newDisabled={currentTask !== null}
          />
        )}

        {loaded && (showPrompt || currentTask || error) && (
          <div className="center">
            {currentTask ? (
              <StepsEntry
                title={currentTask.title}
                created={currentTask.created}
                onFinish={finishSteps}
                onError={setError}
              />
            ) : showPrompt ? (
              <PromptInput
                label="What is your top priority today ?"
                value={priority}
                onChange={setPriority}
                onSubmit={submitPriority}
                // Only closable when the board (and its New button) is there to reopen it.
                onClose={
                  showBoard
                    ? () => {
                        setShowPrompt(false);
                        setPriority("");
                      }
                    : undefined
                }
              />
            ) : null}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </main>

      {resultTask && <ResultModal task={resultTask} onClose={closeResults} />}
      {openTask && <TaskModal
          task={openTask}
          onClose={closeModal}
          onToggleStep={toggleStep}
          onAddStep={addStep}
          onReorder={reorderSteps}
        />}
    </>
  );
}
