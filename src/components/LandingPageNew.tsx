import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { JudgeCodeModal } from "./JudgeCodeModalNew";
import { TeamSubmissionModal } from "./TeamSubmissionModalNew";
import { LoadingState } from "./ui/LoadingState";
import { ErrorState } from "./ui/ErrorState";
import { getEventDisplayLabel, getEventMode, type EventMode } from "../lib/eventModes";
import { formatDateRangeSimple } from "../lib/utils";
import { HOMEPAGE_DEMO } from "../lib/homepageDemo";
import { selectFocalHomepage, type HomepageEvent, type HomepagePhase } from "../lib/homepagePhase";
import { DisplayModule } from "./home/DisplayModule";
import { SemesterRail, type RailEvent } from "./home/SemesterRail";
import { EventLedger, type LedgerPast, type LedgerUpcoming } from "./home/EventLedger";
import { ProjectKeyboard, KEY_GLYPHS, KEY_HUES, type KeyProject } from "./home/ProjectKeyboard";
import "./home/homepage-fi.css";

type LandingEvent = HomepageEvent & {
  description?: string;
  teamCount?: number;
  userRole?: { role?: string } | null;
  judgeProgress?: { completedTeams: number; totalTeams: number };
  requiresJudgeCode?: boolean;
  hasRankedVote?: boolean;
  resultsReleased?: boolean;
  tracks?: string[];
  categories?: Array<string | { name: string }>;
  courseCodes?: string[];
};

/** Broadcast channel to the shell's single sign-in surface (Layout owns the modal). */
export function requestSignIn() {
  window.dispatchEvent(new CustomEvent("hackjudge:open-signin"));
}

function useDemoMode() {
  return useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("demo") === "1";
  }, []);
}

/** Preview affordance: ?demo=1&phase=pre|post|standby pins the demo to a phase. */
function useDemoPhase(): "pre" | "post" | "standby" | null {
  return useMemo(() => {
    if (typeof window === "undefined") return null;
    const p = new URLSearchParams(window.location.search).get("phase");
    return p === "pre" || p === "post" || p === "standby" ? p : null;
  }, []);
}

const DAY_MS = 24 * 3600_000;

/** "24-05-25" — machined date stamp used by module meta. */
function fmtStamp(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${String(d.getUTCFullYear()).slice(2)}`;
}

/** "May 25" / "Now · May 25" — step labels on the semester rail. */
function fmtStepDay(ms: number, prefix = "") {
  const d = new Date(ms);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${prefix}${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function daysUntilLabel(target: number, now: number) {
  const days = Math.max(0, Math.ceil((target - now) / DAY_MS));
  if (days === 0) return "T−0 · today";
  return `T−${days} day${days === 1 ? "" : "s"}`;
}

function primaryLabelFor(event: LandingEvent) {
  const mode = getEventMode(event.mode);
  if (event.status === "past") return "View results";
  if (mode === "demo_day") return "Browse & Appreciate";
  if (mode === "code_and_tell") return event.hasRankedVote ? "Edit Ballot" : "Vote";
  if (event.userRole?.role === "participant") return "Open event";
  return "Start Scoring";
}

export function LandingPage({ onSelectEvent }: { onSelectEvent: (eventId: Id<"events">) => void }) {
  const demoMode = useDemoMode();
  const demoPhase = useDemoPhase();
  const events = useQuery(api.events.listEvents, demoMode ? "skip" : undefined);
  const isAdmin = useQuery(api.events.isUserAdmin, demoMode ? "skip" : undefined);
  const loggedInUser = useQuery(api.auth.loggedInUser, demoMode ? "skip" : undefined);
  const joinAsJudge = useMutation(api.events.joinAsJudge);

  /* Readouts change at day/hour granularity — a 30s beat is plenty. */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const [joiningEvents, setJoiningEvents] = useState<Set<Id<"events">>>(new Set());
  const [judgeCodeModal, setJudgeCodeModal] = useState<{
    isOpen: boolean;
    eventId: Id<"events"> | null;
  }>({ isOpen: false, eventId: null });
  const [teamSubmissionModal, setTeamSubmissionModal] = useState<{
    isOpen: boolean;
    eventId: Id<"events"> | null;
    tracks: string[];
    courseCodes: string[];
    eventMode: EventMode;
    existingTeam: null;
  }>({
    isOpen: false,
    eventId: null,
    tracks: [],
    courseCodes: [],
    eventMode: "hackathon",
    existingTeam: null,
  });
  const [selectedKey, setSelectedKey] = useState<KeyProject | null>(null);

  const effectiveNow = demoMode ? HOMEPAGE_DEMO.nowMs : now;

  const focal = useMemo((): { event: LandingEvent; phase: Exclude<HomepagePhase, "idle"> } | null => {
    if (demoMode) {
      const f = HOMEPAGE_DEMO.focal as LandingEvent;
      const dur = f.endDate - f.startDate;
      const active: LandingEvent[] = demoPhase ? [] : [f];
      let upcoming = HOMEPAGE_DEMO.upcoming as LandingEvent[];
      let past = HOMEPAGE_DEMO.past as LandingEvent[];
      if (demoPhase === "pre") {
        upcoming = [
          {
            ...f,
            status: "upcoming",
            startDate: effectiveNow + 3 * 24 * 3600_000,
            endDate: effectiveNow + 3 * 24 * 3600_000 + dur,
          },
          ...upcoming,
        ];
      } else if (demoPhase === "post") {
        past = [
          {
            ...f,
            status: "past",
            startDate: effectiveNow - 12 * 3600_000 - dur,
            endDate: effectiveNow - 12 * 3600_000,
          },
          ...past,
        ];
      }
      return selectFocalHomepage({ active, upcoming, past }, effectiveNow);
    }
    if (!events) return null;
    return selectFocalHomepage(
      {
        active: events.active as LandingEvent[],
        upcoming: events.upcoming as LandingEvent[],
        past: events.past as LandingEvent[],
      },
      now
    );
  }, [demoMode, demoPhase, events, now, effectiveNow]);

  const teams = useQuery(
    api.teams.listTeams,
    !demoMode && focal ? { eventId: focal.event._id as Id<"events"> } : "skip"
  );

  const openEvent = (id: string) => {
    if (demoMode) {
      toast.message("Demo data — open / for live");
      return;
    }
    onSelectEvent(id as Id<"events">);
  };

  const handleJoinAsJudge = async (eventId: Id<"events">) => {
    if (!loggedInUser) {
      requestSignIn();
      return;
    }
    if (joiningEvents.has(eventId)) return;
    setJoiningEvents((prev) => new Set(prev).add(eventId));
    try {
      await joinAsJudge({ eventId });
      toast.success("Successfully joined as judge!");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to join as judge");
    } finally {
      setJoiningEvents((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    }
  };

  const handleStartScoring = (event: LandingEvent) => {
    if (demoMode) {
      toast.message("Demo data — open / for live");
      return;
    }
    const eventMode = getEventMode(event.mode);
    if (event.status === "past" || eventMode === "demo_day") {
      onSelectEvent(event._id as Id<"events">);
      return;
    }
    if (eventMode === "code_and_tell") {
      if (event.status === "active" && !loggedInUser) {
        requestSignIn();
        return;
      }
      onSelectEvent(event._id as Id<"events">);
      return;
    }
    if (!loggedInUser) {
      requestSignIn();
      return;
    }
    if (event.requiresJudgeCode) {
      setJudgeCodeModal({ isOpen: true, eventId: event._id as Id<"events"> });
    } else {
      onSelectEvent(event._id as Id<"events">);
    }
  };

  const handleAddTeam = (event: LandingEvent) => {
    if (!loggedInUser) {
      requestSignIn();
      return;
    }
    const derivedTracks =
      event.tracks && event.tracks.length > 0
        ? event.tracks
        : (event.categories || []).map((category) =>
            typeof category === "string" ? category : category.name
          );
    setTeamSubmissionModal({
      isOpen: true,
      eventId: event._id as Id<"events">,
      tracks: derivedTracks,
      courseCodes: event.courseCodes || [],
      eventMode: getEventMode(event.mode),
      existingTeam: null,
    });
  };

  if (!demoMode && events === undefined) {
    return <LoadingState label="Loading events..." />;
  }

  if (!demoMode && !events) {
    return (
      <ErrorState
        title="Unable to load events"
        description="We couldn't fetch the list of events right now. Please refresh the page to try again."
        actionLabel="Refresh"
        onAction={() => window.location.reload()}
      />
    );
  }

  const upcomingSource = demoMode
    ? (HOMEPAGE_DEMO.upcoming as LandingEvent[])
    : ((events?.upcoming ?? []) as LandingEvent[]);
  const pastSource = demoMode
    ? (HOMEPAGE_DEMO.past as LandingEvent[])
    : ((events?.past ?? []) as LandingEvent[]);

  const upcomingList = upcomingSource.filter((e) => !focal || e._id !== focal.event._id);
  const pastList = pastSource.filter((e) => !focal || e._id !== focal.event._id);

  /* ---------- rail: every event is a step; the focal one is patched ---------- */
  const nowStep: RailEvent[] = focal
    ? []
    : [
        {
          id: "__now",
          name: "Today",
          mode: "hackathon" as EventMode,
          modeLabel: "—",
          startDate: effectiveNow,
          endDate: effectiveNow,
          relation: "focal" as const,
          dateLabel: fmtStepDay(effectiveNow, "Now · "),
          dateRangeLabel: fmtStamp(effectiveNow),
          statusLabel: "Standby",
          ariaLabel: `Today — ${fmtStamp(effectiveNow)} — no event patched`,
        },
      ];
  const railEvents: RailEvent[] = [
    ...nowStep,
    ...pastList.map((e): RailEvent => {
      return {
        id: e._id,
        name: e.name,
        mode: getEventMode(e.mode),
        modeLabel: getEventDisplayLabel(e.mode),
        startDate: e.startDate,
        endDate: e.endDate,
        relation: "past",
        dateLabel: fmtStepDay(e.startDate),
        dateRangeLabel: formatDateRangeSimple(e.startDate, e.endDate),
        statusLabel: "Closed",
        ariaLabel: `${e.name} — ${formatDateRangeSimple(e.startDate, e.endDate)} — past event`,
      };
    }),
    ...(focal
      ? [
          {
            id: focal.event._id,
            name: focal.event.name,
            mode: getEventMode(focal.event.mode),
            startDate: focal.event.startDate,
            endDate: focal.event.endDate,
            relation: "focal" as const,
            dateLabel: fmtStepDay(focal.event.startDate),
            dateRangeLabel: formatDateRangeSimple(focal.event.startDate, focal.event.endDate),
            modeLabel: getEventDisplayLabel(focal.event.mode),
            statusLabel:
              focal.phase === "live" ? "Live now" : focal.phase === "pre" ? "Armed" : "Replay",
            ariaLabel: `${focal.event.name} — started ${formatDateRangeSimple(focal.event.startDate, focal.event.endDate)} — ${
              focal.phase === "live" ? "live now" : focal.phase === "pre" ? "next up" : "recently ended"
            }`,
            focalTag: focal.phase === "live" ? "Live" : focal.phase === "pre" ? "Next" : "Ended",
          },
        ]
      : []),
    ...upcomingList.map((e): RailEvent => {
      return {
        id: e._id,
        name: e.name,
        mode: getEventMode(e.mode),
        modeLabel: getEventDisplayLabel(e.mode),
        startDate: e.startDate,
        endDate: e.endDate,
        relation: "next",
        dateLabel: fmtStepDay(e.startDate),
        dateRangeLabel: formatDateRangeSimple(e.startDate, e.endDate),
        statusLabel: daysUntilLabel(e.startDate, effectiveNow),
        ariaLabel: `${e.name} — ${formatDateRangeSimple(e.startDate, e.endDate)} — upcoming, ${daysUntilLabel(e.startDate, effectiveNow)}`,
      };
    }),
  ];

  /* ---------- keyboard: teams of the focal event (demo fixture in demo mode) ---------- */
  const keyProjects: KeyProject[] = demoMode
    ? HOMEPAGE_DEMO.projects
    : (teams ?? []).slice(0, 8).map((t: { _id: string; name: string; track?: string }, i: number) => ({
        id: t._id,
        name: t.name,
        team: t.track ?? "Team",
        hue: KEY_HUES[i % KEY_HUES.length]!,
        glyph: KEY_GLYPHS[i % KEY_GLYPHS.length]!,
      }));

  /* ---------- ledger rows ---------- */
  const ledgerUpcoming: LedgerUpcoming[] = [...upcomingList]
    .sort((a, b) => a.startDate - b.startDate)
    .map((e) => {
      const days = Math.max(0, Math.ceil((e.startDate - effectiveNow) / DAY_MS));
      return {
        id: e._id,
        name: e.name,
        mode: getEventMode(e.mode),
        modeLabel: getEventDisplayLabel(e.mode),
        dateLabel: formatDateRangeSimple(e.startDate, e.endDate),
        tMinus: daysUntilLabel(e.startDate, effectiveNow),
        stepsLit: Math.max(0, Math.min(8, Math.round(days / 7))),
        ariaLabel: `View event "${e.name}" — ${daysUntilLabel(e.startDate, effectiveNow)}`,
      };
    });
  const ledgerPast: LedgerPast[] = [...pastList]
    .sort((a, b) => b.endDate - a.endDate)
    .map((e) => ({
      id: e._id,
      name: e.name,
      modeLabel: getEventDisplayLabel(e.mode),
      dateLabel: formatDateRangeSimple(e.startDate, e.endDate),
      ariaLabel: `View event "${e.name}" — closed`,
    }));

  /* ---------- module readouts ---------- */
  const focalEvent = focal?.event ?? null;
  const focalMode = focalEvent ? getEventMode(focalEvent.mode) : "hackathon";
  const seatLabel = demoMode
    ? HOMEPAGE_DEMO.focal.seatLabel
    : focalEvent?.userRole?.role
      ? focalEvent.userRole.role === "judge"
        ? "Judge"
        : "Participant"
      : loggedInUser
        ? "Guest"
        : "Visitor";

  const moduleMeta: Array<[string, string]> = focal
    ? focal.phase === "live"
      ? [
          ["Started", fmtStamp(focal.event.startDate)],
          ["Closes in", `${Math.max(0, Math.ceil((focal.event.endDate - effectiveNow) / 3600_000))} h`],
          ["Seat", seatLabel],
        ]
      : focal.phase === "pre"
        ? [
            ["Opens", fmtStamp(focal.event.startDate)],
            ["Opens in", daysUntilLabel(focal.event.startDate, effectiveNow)],
            ["Seat", seatLabel],
          ]
        : [
            ["Ended", fmtStamp(focal.event.endDate)],
            ["Seat", seatLabel],
          ]
    : [];

  const formatLabel = focal
    ? `${Math.max(1, Math.round((focal.event.endDate - focal.event.startDate) / 3600_000))}h format`
    : undefined;

  const hasRail = railEvents.length > 0;

  const moduleActions: Array<{ label: string; onClick: () => void; disabled?: boolean }> = [];
  if (focal && focalMode === "hackathon" && focal.phase !== "post" && !focal.event.userRole) {
    const fid = focal.event._id as Id<"events">;
    moduleActions.push({
      label: joiningEvents.has(fid) ? "Joining..." : "Join as judge",
      onClick: () => void handleJoinAsJudge(fid),
      disabled: joiningEvents.has(fid),
    });
  }
  if (focal && isAdmin && focalMode === "hackathon") {
    moduleActions.push({
      label: "Add teams",
      onClick: () => handleAddTeam(focal.event),
    });
  }

  return (
    <div className="fi-home">
      {focal && keyProjects.length > 0 && (
        <a className="fi-h-skip" href="#fi-h-projects">
          Skip to projects to score
        </a>
      )}

      <div className="fi-h-unit">
        {focal ? (
          <>
            <DisplayModule
              name={focal.event.name}
              description={focal.event.description || "Judging is open. Enter when you're ready."}
              mode={focalMode}
              modeLabel={getEventDisplayLabel(focal.event.mode)}
              phase={focal.phase}
              formatLabel={formatLabel}
              meta={moduleMeta}
              selectLine={
                selectedKey ? (
                  <>
                    Select · <b>{selectedKey.name}</b> — {selectedKey.team} · ready to score
                  </>
                ) : (
                  "Select · no project key pressed"
                )
              }
              transportLabel={primaryLabelFor(focal.event)}
              onTransport={() => handleStartScoring(focal.event)}
              extraActions={moduleActions}
              onAllEvents={hasRail ? () => document.getElementById("fi-h-upcoming")?.scrollIntoView({ behavior: "smooth" }) : undefined}
            />
          </>
        ) : (
          <DisplayModule
            name="No events programmed"
            description="The instrument has no events patched in right now. When a hackathon, demo day, or code & tell is scheduled, it appears here."
            mode="hackathon"
            modeLabel="—"
            phase={null}
            meta={[]}
            selectLine="Select · no event patched"
            transportLabel="Enter"
            onTransport={() => undefined}
            onAllEvents={hasRail ? () => document.getElementById("fi-h-upcoming")?.scrollIntoView({ behavior: "smooth" }) : undefined}
          />
        )}

        {hasRail && (
          <SemesterRail
            events={railEvents}
            focalId={focal?.event._id ?? null}
            phase={focal?.phase ?? null}
            now={effectiveNow}
            onOpen={openEvent}
          />
        )}

        {focal && hasRail && <div className="fi-h-grille" aria-hidden="true" />}

        {focal && keyProjects.length > 0 && (
          <ProjectKeyboard
            projects={keyProjects}
            onOpen={() => handleStartScoring(focal.event)}
            onReport={setSelectedKey}
          />
        )}

        <EventLedger upcoming={ledgerUpcoming} past={ledgerPast} onOpen={openEvent} />

        <footer className="fi-h-footer">
          <p className="fi-h-blurb">
            One workspace for hackathons, demo days, and code &amp; tells — scoring, rubrics, and
            results.
          </p>
          {!loggedInUser && !demoMode && (
            <button type="button" className="fi-h-footlink" onClick={requestSignIn}>
              Judges &amp; admins
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
                <path d="M3 12h17M13 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </footer>
      </div>

      {demoMode && (
        <p className="fi-h-badge" role="status">
          Preview · Field Instrument · synthetic data — / for live
        </p>
      )}

      {judgeCodeModal.eventId && (
        <JudgeCodeModal
          isOpen={judgeCodeModal.isOpen}
          onClose={() => setJudgeCodeModal({ isOpen: false, eventId: null })}
          eventId={judgeCodeModal.eventId}
          onSuccess={() => judgeCodeModal.eventId && onSelectEvent(judgeCodeModal.eventId)}
        />
      )}
      {teamSubmissionModal.eventId && (
        <TeamSubmissionModal
          isOpen={teamSubmissionModal.isOpen}
          onClose={() =>
            setTeamSubmissionModal({
              isOpen: false,
              eventId: null,
              tracks: [],
              courseCodes: [],
              eventMode: "hackathon",
              existingTeam: null,
            })
          }
          eventId={teamSubmissionModal.eventId}
          tracks={teamSubmissionModal.tracks}
          courseCodes={teamSubmissionModal.courseCodes}
          eventMode={teamSubmissionModal.eventMode}
          existingTeam={teamSubmissionModal.existingTeam}
        />
      )}
    </div>
  );
}
