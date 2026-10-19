import { useState } from "react";
import { api, type Step, type Task } from "../api";
import PromptInput from "./PromptInput";

interface Props {
  task: Task;
  onFinish: () => void;
  onError: (message: string) => void;
}

export default function StepsEntry({ task, onFinish, onError }: Props) {
  const [value, setValue] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);

  const saveStep = async (): Promise<boolean> => {
    const text = value.trim();
    if (!text) return true;
    setBusy(true);
    try {
      const step = await api.addStep(task.id, text);
      setValue("");
      setSteps((prev) => [...prev, step]);
      return true;
    } catch (e) {
      onError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    // Save whatever is still typed in the field before finishing.
    if (await saveStep()) onFinish();
  };

  return (
    <div className="steps-entry">
      <p className="steps-task">{task.title}</p>
      <PromptInput
        label={steps.length === 0 ? "Write the steps to achieve it" : "Next step?"}
        value={value}
        onChange={setValue}
        onSubmit={saveStep}
        disabled={busy}
      >
        <div className="prompt-actions">
          {steps.length > 0 && (
            <span className="steps-count">
              {steps.length} step{steps.length === 1 ? "" : "s"} saved
            </span>
          )}
          <button type="button" className="link-button" onClick={finish} disabled={busy}>
            Finish
          </button>
        </div>
      </PromptInput>
      {steps.length > 0 && (
        <ol className="step-thread" aria-label="Steps so far">
          {steps.map((s) => (
            <li key={s.id}>{s.text}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
