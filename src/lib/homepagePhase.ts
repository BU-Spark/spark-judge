import { getEventMode, type EventMode } from "./eventModes";

/** Hours after an event ends that it remains the focal "replay" window. */
export const POST_HOLD_MS = 48 * 60 * 60 * 1000;
/** Days before start when an upcoming event becomes the focal "pre" window (armed). */
export const PRE_WINDOW_MS = 10 * 24 * 60 * 60 * 1000;

export type HomepagePhase = "pre" | "live" | "post" | "idle";

export type HomepageEvent = {
  _id: string;
  name: string;
  status: "upcoming" | "active" | "past";
  startDate: number;
  endDate: number;
  mode?: string | null;
};

export type FocalHomepage = {
  event: HomepageEvent;
  phase: Exclude<HomepagePhase, "idle">;
  pageCode: string;
  phaseLabel: string;
};

function modeBase(mode: EventMode): number {
  switch (mode) {
    case "demo_day":
      return 200;
    case "code_and_tell":
      return 300;
    default:
      return 100;
  }
}

function phaseOffset(phase: Exclude<HomepagePhase, "idle">): number {
  switch (phase) {
    case "pre":
      return 1;
    case "live":
      return 2;
    case "post":
      return 3;
  }
}

export function pageCodeFor(mode: EventMode, phase: Exclude<HomepagePhase, "idle">): string {
  return `P${modeBase(mode) + phaseOffset(phase)}`;
}

export function phaseLabel(phase: Exclude<HomepagePhase, "idle">): string {
  switch (phase) {
    case "pre":
      return "PRE";
    case "live":
      return "LIVE";
    case "post":
      return "FINAL";
  }
}

/**
 * Pick the single focal event and its homepage phase — a phase machine, not a
 * recency sort (semester-rail shape, confirmed 2026-08-12).
 * Priority: live → pre (armed, within pre-window) → replay (within post-hold) →
 * standby (null). There are no fallbacks to far-future or long-past events:
 * outside every window the instrument idles in standby.
 */
export function selectFocalHomepage(
  events: {
    active: HomepageEvent[];
    upcoming: HomepageEvent[];
    past: HomepageEvent[];
  },
  now = Date.now()
): FocalHomepage | null {
  if (events.active.length > 0) {
    const event = [...events.active].sort((a, b) => a.startDate - b.startDate)[0]!;
    const mode = getEventMode(event.mode);
    const phase = "live" as const;
    return {
      event,
      phase,
      pageCode: pageCodeFor(mode, phase),
      phaseLabel: phaseLabel(phase),
    };
  }

  const upcomingSorted = [...events.upcoming].sort((a, b) => a.startDate - b.startDate);
  const armed = upcomingSorted.find((e) => e.startDate > now && e.startDate - now <= PRE_WINDOW_MS);
  if (armed) {
    const mode = getEventMode(armed.mode);
    const phase = "pre" as const;
    return {
      event: armed,
      phase,
      pageCode: pageCodeFor(mode, phase),
      phaseLabel: phaseLabel(phase),
    };
  }

  const recentPast = [...events.past]
    .filter((e) => now - e.endDate <= POST_HOLD_MS && now >= e.endDate)
    .sort((a, b) => b.endDate - a.endDate)[0];

  if (recentPast) {
    const mode = getEventMode(recentPast.mode);
    const phase = "post" as const;
    return {
      event: recentPast,
      phase,
      pageCode: pageCodeFor(mode, phase),
      phaseLabel: phaseLabel(phase),
    };
  }

  return null;
}

export function formatTeletextClock(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 99) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function focalCountdownMs(
  event: HomepageEvent,
  phase: Exclude<HomepagePhase, "idle">,
  now = Date.now()
): number {
  switch (phase) {
    case "pre":
      return Math.max(0, event.startDate - now);
    case "live":
      return Math.max(0, event.endDate - now);
    case "post":
      return Math.max(0, now - event.endDate);
  }
}

export function countdownCaption(phase: Exclude<HomepagePhase, "idle">): string {
  switch (phase) {
    case "pre":
      return "OPENS IN";
    case "live":
      return "CLOSES IN";
    case "post":
      return "CLOSED";
  }
}
