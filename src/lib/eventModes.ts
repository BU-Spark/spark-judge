export const EVENT_MODES = [
  "hackathon",
  "demo_day",
  "code_and_tell",
] as const;

export type EventMode = (typeof EVENT_MODES)[number];

export function getEventMode(mode?: string | null): EventMode {
  if (mode === "demo_day" || mode === "code_and_tell") {
    return mode;
  }
  return "hackathon";
}

export function isHackathonMode(mode?: string | null): boolean {
  return getEventMode(mode) === "hackathon";
}

export function isDemoDayMode(mode?: string | null): boolean {
  return getEventMode(mode) === "demo_day";
}

export function isCodeAndTellMode(mode?: string | null): boolean {
  return getEventMode(mode) === "code_and_tell";
}

export function getEventDisplayLabel(mode?: string | null): string {
  switch (getEventMode(mode)) {
    case "demo_day":
      return "Demo Day";
    case "code_and_tell":
      return "Code & Tell";
    default:
      return "Hackathon";
  }
}
