import { useRef, useState } from "react";
import { api, type Task } from "../api";
import Bolt from "./Bolt";
import PromptInput from "./PromptInput";

interface Props {
  title: string;
  /** Resolves once the server has created the task; steps are saved after it. */
  created: Promise<Task>;
  /** Called immediately with a local copy of the task; `saved` resolves when all saves are done. */
  onFinish: (draft: Task, saved: Promise<void>) => void;
  onError: (message: string) => void;
}

interface DraftStep {
  key: number;
  text: string;
}

let nextKey = 1;

export default function StepsEntry({ title, created, onFinish, onError }: Props) {
  const [value, setValue] = useState("");
  const [steps, setSteps] = useState<DraftStep[]>([]);
  // Steps show up right away; saves run one after another, in the order typed. Never rejects.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const saveStep = (): DraftStep[] => {
    const text = value.trim();
    if (!text) return steps;
    const step = { key: nextKey++, text };
    const all = [...steps, step];
    setValue("");
    setSteps(all);
    queue.current = queue.current.then(async () => {
      try {
        await api.addStep((await created).id, text);
      } catch (e) {
        setSteps((prev) => prev.filter((s) => s.key !== step.key));
        onError((e as Error).message);
      }
    });
    return all;
  };

  const finish = () => {
    // Save whatever is still typed in the field before finishing.
    const all = saveStep();
    const taskId = -Date.now(); // placeholder ids until the board refreshes from the server
    onFinish(
      {
        id: taskId,
        title,
        status: "todo",
        created_at: "",
        steps: all.map((s, i) => ({ id: -s.key, task_id: taskId, text: s.text, position: i, done: false })),
      },
      queue.current,
    );
  };

  return (
    <div className="steps-entry">
      <h1 className="steps-task">
        <Bolt size={34} />
        <span>{title}</span>
      </h1>
      <PromptInput
        label={steps.length === 0 ? "Write the steps to achieve it" : "Next step?"}
        value={value}
        onChange={setValue}
        onSubmit={saveStep}
      >
        <div className="prompt-actions">
          {steps.length > 0 && (
            <span className="steps-count">
              {steps.length} step{steps.length === 1 ? "" : "s"} saved
            </span>
          )}
          <button type="button" className="link-button" onClick={finish}>
            Finish
          </button>
        </div>
      </PromptInput>
      {steps.length > 0 && (
        <ol className="step-thread" aria-label="Steps so far">
          {steps.map((s) => (
            <li key={s.key}>{s.text}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
