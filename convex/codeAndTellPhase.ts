export type CodeAndTellPhase =
  | "submissions"
  | "presentations"
  | "voting"
  | "closed";

/** Existing events retain their legacy status until an organizer takes control. */
export function codeAndTellPhase(event: {
  codeAndTellPhase?: CodeAndTellPhase;
  status?: string;
  resultsReleased?: boolean;
}): CodeAndTellPhase {
  if (event.resultsReleased) return "closed";
  return (
    event.codeAndTellPhase ??
    (event.status === "active"
      ? "voting"
      : event.status === "past"
        ? "closed"
        : "submissions")
  );
}
