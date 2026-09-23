import { computeEventDisplayStatus } from "./eventStatus";
import { getEventMode, type EventMode } from "./eventModes";

/** Hours after an event ends that it remains the focal "replay" window. */
export const POST_HOLD_MS = 48 * 60 * 60 * 1000;
/** Legacy preview threshold, retained for compatibility. Event stage has no pre-window cutoff. */
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

export function pageCodeFor(
  mode: EventMode,
  phase: Exclude<HomepagePhase, "idle">,
): string {
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

/** Reclassify as the clock advances, even when no Convex document changes. */
export function groupHomepageEvents<T extends HomepageEvent>(
  events: T[],
  now: number,
) {
  const groups: { active: T[]; upcoming: T[]; past: T[] } = {
    active: [],
    upcoming: [],
    past: [],
  };
  for (const event of events) {
    const status = computeEventDisplayStatus({ ...event, now });
    groups[
      status === "active" ? "active" : status === "past" ? "past" : "upcoming"
    ].push({ ...event, status });
  }
  groups.active.sort(
    (a, b) => a.startDate - b.startDate || a._id.localeCompare(b._id),
  );
  groups.upcoming.sort(
    (a, b) => a.startDate - b.startDate || a._id.localeCompare(b._id),
  );
  groups.past.sort(
    (a, b) => b.endDate - a.endDate || a._id.localeCompare(b._id),
  );
  return groups;
}

/** Live first, then a 48-hour recap, then the next event regardless of distance.
 * A manual choice only applies to currently live events and expires with them.
 */
export function selectFocalHomepage<T extends HomepageEvent>(
  events: { active: T[]; upcoming: T[]; past: T[] },
  now = Date.now(),
  selectedLiveId?: string | null,
): (Omit<FocalHomepage, "event"> & { event: T }) | null {
  const live = [...events.active].sort(
    (a, b) => a.startDate - b.startDate || a._id.localeCompare(b._id),
  );
  const event =
    live.find((e) => e._id === selectedLiveId) ??
    live[0] ??
    [...events.past]
      .filter((e) => now >= e.endDate && now - e.endDate < POST_HOLD_MS)
      .sort((a, b) => b.endDate - a.endDate)[0] ??
    [...events.upcoming]
      .filter((e) => e.startDate > now)
      .sort((a, b) => a.startDate - b.startDate)[0];
  if (!event) return null;
  const phase =
    event.status === "active"
      ? "live"
      : event.status === "past"
        ? "post"
        : "pre";
  return {
    event,
    phase,
    pageCode: pageCodeFor(getEventMode(event.mode), phase),
    phaseLabel: phaseLabel(phase),
  };
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
  now = Date.now(),
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

export function countdownCaption(
  phase: Exclude<HomepagePhase, "idle">,
): string {
  switch (phase) {
    case "pre":
      return "OPENS IN";
    case "live":
      return "CLOSES IN";
    case "post":
      return "CLOSED";
  }
}
