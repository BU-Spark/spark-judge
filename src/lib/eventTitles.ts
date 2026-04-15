/** Local calendar date only (no time), for default Code & Tell event titles. */
export function formatLocalDateNoTime(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatCodeAndTellDefaultTitle(startMs: number): string {
  return `Code & Tell (${formatLocalDateNoTime(startMs)})`;
}
