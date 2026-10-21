/** Show text starting with a capital letter, however it was typed (or stored). */
export const cap = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Steps keep bold parts between ** markers, e.g. "Buy **two** tickets".
 * Returns the text split into runs so it can be rendered without raw HTML.
 */
export function boldRuns(text: string): { text: string; bold: boolean }[] {
  return text
    .split("**")
    .map((part, i) => ({ text: part, bold: i % 2 === 1 }))
    .filter((r) => r.text);
}

/** Wrap the selection in ** markers, or strip them if it is already wrapped. */
export function toggleBold(
  value: string,
  start: number,
  end: number,
): { value: string; start: number; end: number } {
  if (start === end) return { value, start, end };
  const before = value.slice(0, start);
  const mid = value.slice(start, end);
  const after = value.slice(end);
  if (before.endsWith("**") && after.startsWith("**")) {
    return { value: before.slice(0, -2) + mid + after.slice(2), start: start - 2, end: end - 2 };
  }
  if (mid.length > 4 && mid.startsWith("**") && mid.endsWith("**")) {
    return { value: before + mid.slice(2, -2) + after, start, end: end - 4 };
  }
  return { value: `${before}**${mid}**${after}`, start: start + 2, end: end + 2 };
}
