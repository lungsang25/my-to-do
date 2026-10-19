import { useCallback, useEffect, useState } from "react";
import { api, type Task } from "./api";
import { useTheme } from "./theme";
import ThemeToggle from "./components/ThemeToggle";
import PromptInput from "./components/PromptInput";
import StepsEntry from "./components/StepsEntry";
import Board from "./components/Board";
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

  const deleteTask = async (task: Task) => {
    if (task.id < 0) return; // not saved yet; real ids arrive with the next refresh
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    const remaining = tasks.filter((t) => t.id !== task.id);
    setTasks(remaining); // optimistic
    if (openTaskId === task.id) setOpenTaskId(null);
    if (remaining.length === 0) setShowPrompt(true); // board disappears; match first visit
    try {
      await api.deleteTask(task.id);
    } catch (e) {
      setError((e as Error).message);
      await refresh(); // restore the server's state
    }
  };

  const closeModal = useCallback(() => setOpenTaskId(null), []);
  const openTask = tasks.find((t) => t.id === openTaskId) ?? null;
  const showBoard = tasks.length > 0;

  return (
    <>
      <ThemeToggle theme={theme} onToggle={toggle} />

      <main className={showBoard ? "layout with-board" : "layout"}>
        {showBoard && (
          <Board
            tasks={tasks}
            onOpen={(t) => setOpenTaskId(t.id)}
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
                label="What is your top priority to do?"
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

      {openTask && <TaskModal task={openTask} onClose={closeModal} onToggleStep={toggleStep} />}
    </>
  );
}
