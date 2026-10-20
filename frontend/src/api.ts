export type Status = "todo" | "in_progress" | "done";

export interface Step {
  id: number;
  task_id: number;
  text: string;
  position: number;
  done: boolean;
}

export interface Result {
  id: number;
  task_id: number;
  text: string;
  position: number;
}

export interface Task {
  id: number;
  title: string;
  status: Status;
  created_at: string;
  completed_at: string | null;
  /** Duration key active when the task was created, e.g. "1d", "2w". */
  duration: string;
  steps: Step[];
  results: Result[];
}

export interface DurationState {
  active: string;
  /** Every duration used so far, with the local date its periods are counted from. */
  durations: { key: string; anchor: string }[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  listTasks: () => request<Task[]>("/tasks"),
  createTask: (title: string) =>
    request<Task>("/tasks", { method: "POST", body: JSON.stringify({ title }) }),
  addStep: (taskId: number, text: string) =>
    request<Step>(`/tasks/${taskId}/steps`, { method: "POST", body: JSON.stringify({ text }) }),
  addResult: (taskId: number, text: string) =>
    request<Result>(`/tasks/${taskId}/results`, { method: "POST", body: JSON.stringify({ text }) }),
  reorderSteps: (taskId: number, stepIds: number[]) =>
    request<void>(`/tasks/${taskId}/steps/order`, {
      method: "PUT",
      body: JSON.stringify({ step_ids: stepIds }),
    }),
  setStepDone: (stepId: number, done: boolean) =>
    request<Step>(`/steps/${stepId}`, { method: "PATCH", body: JSON.stringify({ done }) }),
  getDuration: () => request<DurationState>("/duration"),
  setDuration: (key: string, anchor: string) =>
    request<DurationState>("/duration", { method: "PUT", body: JSON.stringify({ key, anchor }) }),
  deleteTask: (taskId: number) => request<void>(`/tasks/${taskId}`, { method: "DELETE" }),
};
