import type { LifecycleStep } from "./EventLifecycle";

export type HackathonPhase = "setup" | "judging" | "deliberate" | "published";

export const HACKATHON_STEPS: LifecycleStep[] = [
  { id: "setup", label: "Set up" },
  { id: "judging", label: "Judging" },
  { id: "deliberate", label: "Deliberate" },
  { id: "published", label: "Published" },
];

export function getHackathonPhase(input: {
  status: "upcoming" | "active" | "past";
  scoringLocked: boolean;
  resultsReleased: boolean;
}): HackathonPhase {
  if (input.resultsReleased) return "published";
  if (input.status === "upcoming") return "setup";
  if (input.status === "active" && !input.scoringLocked) return "judging";
  return "deliberate";
}
