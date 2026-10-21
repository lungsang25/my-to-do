import { boldRuns, cap } from "../text";

/** A step's text with its **bold** parts rendered. */
export default function RichText({ text }: { text: string }) {
  const runs = boldRuns(text);
  if (runs.length) runs[0] = { ...runs[0], text: cap(runs[0].text) };
  return <>{runs.map((r, i) => (r.bold ? <strong key={i}>{r.text}</strong> : r.text))}</>;
}
