import { getEventMode } from "./eventModes";
import type { StageEvent, StageProject } from "../components/home/EventStage";

/** Local design fixtures. Never submitted to Convex or used without ?demo=1. */
export function getStagePreview(params: URLSearchParams) {
  const now = Date.UTC(2026, 9, 8, 17);
  const day = 86_400_000;
  const mode = getEventMode(params.get("mode"));
  const phase = params.get("phase") ?? "pre";
  const names = {
    hackathon: "CivicHacks 2026",
    demo_day: "Fall Demo Day",
    code_and_tell: "Code & Tell: Fresh ideas",
  };
  const descriptions = {
    hackathon:
      "Meet the teams building for their communities. Explore the projects and get ready to judge.",
    demo_day:
      "A semester of ideas, ready to share. Meet the projects and show the teams what you love.",
    code_and_tell:
      "Small projects. New perspectives. Explore what everyone made and choose your favorites.",
  };
  const event: StageEvent = {
    _id: `preview-${mode}`,
    name: names[mode],
    description: descriptions[mode],
    mode,
    startDate: phase === "pre" ? now + 4 * day : now - day,
    endDate:
      phase === "pre"
        ? now + 4 * day + 4 * 3600_000
        : phase === "post"
          ? now - 3600_000
          : now + 3 * 3600_000,
    status: phase === "pre" ? "upcoming" : phase === "post" ? "past" : "active",
    teamCount: 4,
    resultsReleased: params.get("results") === "1",
    categories: [
      { name: "Innovation", weight: 1 },
      { name: "Impact", weight: 1 },
      { name: "Execution", weight: 1 },
    ],
  };
  const events: StageEvent[] =
    phase === "empty"
      ? []
      : [
          event,
          {
            _id: "preview-next",
            name: "Community showcase",
            mode: "demo_day",
            status: "upcoming",
            startDate: now + 17 * day,
            endDate: now + 17 * day + 4 * 3600_000,
          },
          {
            _id: "preview-code",
            name: "Code & Tell: In progress",
            mode: "code_and_tell",
            status: "upcoming",
            startDate: now + 32 * day,
            endDate: now + 32 * day + 3 * 3600_000,
          },
          {
            _id: "preview-past",
            name: "Spring Demo Day",
            mode: "demo_day",
            status: "past",
            startDate: now - 150 * day,
            endDate: now - 150 * day + 4 * 3600_000,
          },
        ];
  if (params.get("overlap") === "1" && phase !== "empty") {
    event.status = "active";
    event.startDate = now - 2 * 3600_000;
    event.endDate = now + 4 * 3600_000;
    events.push({
      ...event,
      _id: "preview-overlap",
      name: mode === "demo_day" ? names.code_and_tell : names.demo_day,
      description:
        descriptions[mode === "demo_day" ? "code_and_tell" : "demo_day"],
      mode: mode === "demo_day" ? "code_and_tell" : "demo_day",
      startDate: now - 3600_000,
    });
  }
  const projects: StageProject[] =
    params.get("projects") === "empty"
      ? []
      : [
          {
            _id: "preview-voltify",
            name: "Voltify",
            track: "Energy",
            description: "Helping neighbors share clean energy.",
          },
          {
            _id: "preview-agrisense",
            name: "AgriSense",
            track: "Environment",
            description: "Making sense of soil, one garden at a time.",
          },
          {
            _id: "preview-medsync",
            name: "MedSync",
            track: "Health",
            description: "Keeping care teams on the same page.",
          },
          {
            _id: "preview-lingua",
            name: "LinguaLink",
            track: "Community",
            description: "Helping people learn a language together.",
          },
        ];
  return { now, events, projects };
}
