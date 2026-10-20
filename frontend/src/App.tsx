import { useCallback, useEffect, useMemo, useState } from "react";
import { cap } from "./text";
import { api, type DurationState, type Task } from "./api";
import { useTheme } from "./theme";
import { computeStreak, dayKey, nowUtc, parseUtc } from "./streak";
import { approxDays, durationLabel, periodIndex, periodName } from "./period";
import ThemeToggle from "./components/ThemeToggle";
import PromptInput from "./components/PromptInput";
import StepsEntry from "./components/StepsEntry";
import Board from "./components/Board";
import ResultModal from "./components/ResultModal";
import TaskModal from "./components/TaskModal";
import HistoryModal from "./components/HistoryModal";
import TimerModal from "./components/TimerModal";
import TimerDock from "./components/TimerDock";
import DurationModal from "./components/DurationModal";
import { requestNotifyPermission } from "./timerAlerts";

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
  const [showHistory, setShowHistory] = useState(false);
  // Bumped at local midnight so the board re-evaluates which done tasks belong in History.
  // (Every period starts at a local midnight, so this covers all durations.)
  const [dayTick, setDayTick] = useState(0);
  const [duration, setDuration] = useState<DurationState>({ active: "1d", durations: [] });
  const [showDuration, setShowDuration] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  // When the running timer ends (epoch ms). Kept in localStorage so a refresh doesn't lose it.
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(() => {
    try {
      const saved = Number(localStorage.getItem("timerEndsAt"));
      return saved > 0 ? saved : null;
    } catch {
      return null;
    }
  });
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
    api
      .getDuration()
      .then(setDuration)
      .catch((e) => setError((e as Error).message));
  }, [refresh]);

  useEffect(() => {
    let timer: number;
    const schedule = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = window.setTimeout(() => {
        setDayTick((n) => n + 1);
        schedule();
      }, midnight.getTime() - now.getTime() + 1000);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);

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
    setTasks((prev) => [...prev, { ...draft, duration: duration.active }]); // optimistic
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
          if (!steps.every((s) => s.done)) return { ...t, steps, status: "todo", completed_at: null };
          // Keep the original finish time if it was already done.
          return { ...t, steps, status: "done", completed_at: t.completed_at ?? nowUtc() };
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
      prev.map((t) => (t.id === task.id ? { ...t, steps: [...t.steps, temp], status: "todo", completed_at: null } : t)),
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
  const closeTimer = useCallback(() => setShowTimer(false), []);
  const changeTimer = useCallback((endsAt: number | null) => {
    setTimerEndsAt(endsAt);
    try {
      if (endsAt === null) localStorage.removeItem("timerEndsAt");
      else localStorage.setItem("timerEndsAt", String(endsAt));
    } catch {
      /* storage unavailable; the timer still runs for this page view */
    }
  }, []);
  const closeHistory = useCallback(() => setShowHistory(false), []);
  const closeDuration = useCallback(() => setShowDuration(false), []);

  const chooseDuration = async (key: string) => {
    setShowDuration(false);
    const today = dayKey(new Date());
    // Optimistic: a duration chosen for the first time starts its periods today.
    setDuration((prev) => ({
      active: key,
      durations: prev.durations.some((d) => d.key === key)
        ? prev.durations
        : [...prev.durations, { key, anchor: today }],
    }));
    try {
      setDuration(await api.setDuration(key, today));
    } catch (e) {
      setError((e as Error).message);
      api.getDuration().then(setDuration).catch(() => {});
    }
  };

  // Where each duration's periods are counted from (today if it has never been saved).
  const anchorOf = useCallback(
    (key: string) => duration.durations.find((d) => d.key === key)?.anchor ?? dayKey(new Date()),
    [duration],
  );
  // A done task stays on the board until its own duration's period is over.
  const isCurrent = useCallback(
    (t: Task) => {
      if (t.status !== "done" || !t.completed_at) return true;
      const anchor = anchorOf(t.duration);
      return (
        periodIndex(parseUtc(t.completed_at), t.duration, anchor) ===
        periodIndex(new Date(), t.duration, anchor)
      );
    },
    // dayTick: re-check when a new day (and maybe a new period) starts.
    [anchorOf, dayTick],
  );
  const streakFor = useCallback((key: string) => computeStreak(tasks, key, anchorOf(key)), [tasks, anchorOf, dayTick]);
  const resultTask = tasks.find((t) => t.id === resultTaskId) ?? null;
  const openTask = tasks.find((t) => t.id === openTaskId) ?? null;
  // Each duration is its own list: the board and History only show tasks created under the
  // active one. The board stays up while any task exists so Duration can switch back.
  const durationTasks = useMemo(
    () => tasks.filter((t) => t.duration === duration.active),
    [tasks, duration.active],
  );
  const showBoard = tasks.length > 0;
  // Durations the user has used: ones they've set, plus any that tasks were created under
  // (e.g. the default 1 day, before any duration was ever chosen). Shortest first.
  const durationOptions = useMemo(
    () =>
      [...new Set([...duration.durations.map((d) => d.key), ...tasks.map((t) => t.duration)])].sort(
        (a, b) => approxDays(a) - approxDays(b),
      ),
    [duration.durations, tasks],
  );
  const streak = useMemo(() => streakFor(duration.active), [streakFor, duration.active]);
  // While adding a task, show only the field (the board returns when it's done or closed).
  const entering = showPrompt || currentTask !== null;

  return (
    <>
      <ThemeToggle theme={theme} onToggle={toggle} />

      <main className={showBoard && !entering ? "layout with-board" : "layout"}>
        {showBoard && !entering && (
          <Board
            tasks={durationTasks}
            onOpen={(t) => setOpenTaskId(t.id)}
            onShowResults={(t) => setResultTaskId(t.id)}
            onDelete={deleteTask}
            onNew={() => setShowPrompt(true)}
            onShowHistory={() => setShowHistory(true)}
            onShowTimer={() => setShowTimer(true)}
            onShowDuration={() => setShowDuration(true)}
            newDisabled={currentTask !== null}
            streak={streak}
            duration={duration.active}
            isCurrent={isCurrent}
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
                label={`What is your top priority ${
                  duration.active === "1d" ? "today" : `this ${periodName(duration.active)}`
                } ?`}
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
      {showHistory && (
        <HistoryModal
          tasks={durationTasks}
          durationLabel={durationLabel(duration.active)}
          onClose={closeHistory}
        />
      )}
      {showDuration && (
        <DurationModal
          active={duration.active}
          options={durationOptions}
          streaks={Object.fromEntries(durationOptions.map((k) => [k, streakFor(k).count]))}
          onChoose={chooseDuration}
          onClose={closeDuration}
        />
      )}
      {showTimer && (
        <TimerModal
          onClose={closeTimer}
          onStart={(seconds) => {
            requestNotifyPermission();
            changeTimer(Date.now() + seconds * 1000);
            setShowTimer(false);
          }}
        />
      )}
      {timerEndsAt !== null && <TimerDock endsAt={timerEndsAt} onCancel={() => changeTimer(null)} />}
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
