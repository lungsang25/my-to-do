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

interface Draft {
  key: number;
  text: string;
}

type Phase = "steps" | "results";

let nextKey = 1;

export default function StepsEntry({ title, created, onFinish, onError }: Props) {
  const [phase, setPhase] = useState<Phase>("steps");
  // After "Finish" on the steps, the user picks Skip (keep adding steps) or Result.
  const [choosing, setChoosing] = useState(false);
  const [value, setValue] = useState("");
  const [steps, setSteps] = useState<Draft[]>([]);
  const [results, setResults] = useState<Draft[]>([]);
  // Items show up right away; saves run one after another, in the order typed. Never rejects.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const save = (kind: Phase): { steps: Draft[]; results: Draft[] } => {
    const text = value.trim();
    const current = kind === "steps" ? steps : results;
    if (!text) return { steps, results };
    const item = { key: nextKey++, text };
    const all = [...current, item];
    const setList = kind === "steps" ? setSteps : setResults;
    setValue("");
    setList(all);
    queue.current = queue.current.then(async () => {
      try {
        const id = (await created).id;
        await (kind === "steps" ? api.addStep(id, text) : api.addResult(id, text));
      } catch (e) {
        setList((prev) => prev.filter((x) => x.key !== item.key));
        onError((e as Error).message);
      }
    });
    return kind === "steps" ? { steps: all, results } : { steps, results: all };
  };

  const finish = () => {
    // Save whatever is still typed in the field before finishing.
    const saved = save(phase);
    const taskId = -Date.now(); // placeholder ids until the board refreshes from the server
    onFinish(
      {
        id: taskId,
        title,
        status: "todo",
        created_at: "",
        steps: saved.steps.map((s, i) => ({ id: -s.key, task_id: taskId, text: s.text, position: i, done: false })),
        results: saved.results.map((r, i) => ({ id: -r.key, task_id: taskId, text: r.text, position: i })),
      },
      queue.current,
    );
  };

  const onFinishSteps = () => {
    save("steps");
    setChoosing(true);
  };

  const list = phase === "steps" ? steps : results;
  const noun = phase === "steps" ? "step" : "result";

  return (
    <div className="steps-entry">
      <h1 className="steps-task">
        <Bolt size={34} />
        <span>{title}</span>
      </h1>
      <PromptInput
        label={
          phase === "results"
            ? "What will be the result after completing the task ?"
            : steps.length === 0
              ? "Write the steps to achieve it"
              : "Next step?"
        }
        value={value}
        onChange={setValue}
        onSubmit={() => save(phase)}
      >
        <div className="prompt-actions">
          {list.length > 0 && (
            <span className="steps-count">
              {list.length} {noun}
              {list.length === 1 ? "" : "s"} saved
            </span>
          )}
          {phase === "steps" && choosing ? (
            <>
              <button type="button" className="link-button" onClick={finish}>
                Skip
              </button>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setPhase("results");
                  setChoosing(false);
                }}
              >
                Result
              </button>
            </>
          ) : (
            <button
              type="button"
              className="link-button"
              onClick={phase === "steps" ? onFinishSteps : finish}
            >
              Finish
            </button>
          )}
        </div>
      </PromptInput>
      {list.length > 0 && (
        <ol className="step-thread" aria-label={phase === "steps" ? "Steps so far" : "Results so far"}>
          {list.map((x) => (
            <li key={x.key}>{x.text}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
