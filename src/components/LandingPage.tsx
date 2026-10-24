import { CodeAndTellVoteView } from "./code-and-tell/CodeAndTellVoteView";
import { Suspense, useEffect, useMemo, useState } from "react";
import { CodeAndTellPreview } from "@/devRoutes";
import { useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { JudgeCodeModal } from "./JudgeCodeModal";
import { TeamSubmissionModal } from "./TeamSubmissionModal";
import { getEventMode, type EventMode } from "../lib/eventModes";
import { groupHomepageEvents, selectFocalHomepage } from "../lib/homepagePhase";
import {
  EventStage,
  type StageEvent,
  type StageProject,
} from "./home/EventStage";
import { getStagePreview } from "../lib/eventStagePreview";
import "./home/event-stage.css";
import { requestSignIn } from "../lib/signIn";

type LandingEvent = StageEvent;
export function LandingPage({
  onSelectEvent,
}: {
  onSelectEvent: (eventId: Id<"events">) => void;
}) {
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  // Sample fixtures are a development-only review aid.
  const demoMode = import.meta.env.DEV && params.get("demo") === "1";
  const preview = useMemo(() => getStagePreview(params), [params]);
  const events = useQuery(api.events.listEvents, demoMode ? "skip" : undefined);
  const isAdmin = useQuery(
    api.events.isUserAdmin,
    demoMode ? "skip" : undefined,
  );
  const loggedInUser = useQuery(
    api.auth.loggedInUser,
    demoMode ? "skip" : undefined,
  );
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 30_000);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", tick);
    };
  }, []);
  const effectiveNow = demoMode ? preview.now : now;
  const [selectedLiveId, setSelectedLiveId] = useState<string | null>(null);
  const groups = useMemo(
    () =>
      groupHomepageEvents<StageEvent>(
        demoMode
          ? preview.events
          : [
              ...(events?.active ?? []),
              ...(events?.upcoming ?? []),
              ...(events?.past ?? []),
            ],
        effectiveNow,
      ),
    [demoMode, preview, events, effectiveNow],
  );
  const focal = selectFocalHomepage(groups, effectiveNow, selectedLiveId);
  const teams = useQuery(
    api.teams.listTeams,
    !demoMode && focal ? { eventId: focal.event._id as Id<"events"> } : "skip",
  );
  const projects: StageProject[] | undefined = demoMode
    ? preview.projects
    : teams;
  const [previewNotice, setPreviewNotice] = useState("");
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
  const openEvent = (id: string) => {
    if (demoMode) {
      setPreviewNotice(
        "This is a design preview. Open the live homepage to participate.",
      );
      return;
    }
    onSelectEvent(id as Id<"events">);
  };
  const handleStartScoring = (event: LandingEvent) => {
    if (demoMode) {
      void navigate(`/participation-preview?mode=${getEventMode(event.mode)}`);
      return;
    }
    const eventMode = getEventMode(event.mode);
    if (event.status !== "active" || eventMode === "demo_day") {
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
            typeof category === "string" ? category : category.name,
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

  if (focal && getEventMode(focal.event.mode) === "code_and_tell" && params.get("all") !== "1") {
    if (demoMode && CodeAndTellPreview) return <Suspense fallback={null}><CodeAndTellPreview /></Suspense>;
    return <CodeAndTellHome eventId={focal.event._id as Id<"events">} />;
  }
  return (
    <>
      <EventStage
        focal={focal}
        events={groups}
        projects={projects}
        loading={!demoMode && events === undefined}
        now={effectiveNow}
        demo={demoMode}
        notice={previewNotice}
        onSelectLive={setSelectedLiveId}
        onOpenEvent={openEvent}
        onParticipate={() => focal && handleStartScoring(focal.event)}
        onOpenProject={(project) => {
          if (!focal) return;
          if (demoMode) {
            setPreviewNotice(
              "Project details are available in the live event. This preview uses sample projects.",
            );
            return;
          }
          void navigate(`/event/${focal.event._id}/team/${project._id}`);
        }}
        onAddTeams={
          focal && isAdmin && getEventMode(focal.event.mode) === "hackathon"
            ? () => handleAddTeam(focal.event)
            : undefined
        }
      />
      {judgeCodeModal.eventId && (
        <JudgeCodeModal
          isOpen={judgeCodeModal.isOpen}
          onClose={() => setJudgeCodeModal({ isOpen: false, eventId: null })}
          eventId={judgeCodeModal.eventId}
          onSuccess={() =>
            judgeCodeModal.eventId && onSelectEvent(judgeCodeModal.eventId)
          }
        />
      )}
      {teamSubmissionModal.eventId && (
        <TeamSubmissionModal
          {...teamSubmissionModal}
          eventId={teamSubmissionModal.eventId}
          onClose={() =>
            setTeamSubmissionModal((state) => ({
              ...state,
              isOpen: false,
              eventId: null,
            }))
          }
        />
      )}
    </>
  );
}

function CodeAndTellHome({ eventId }: { eventId: Id<"events"> }) {
  const event = useQuery(api.events.getEvent, { eventId });
  if (!event) return <p role="status" className="p-8">Loading event…</p>;
  return <CodeAndTellVoteView eventId={eventId} event={event} onBack={() => { window.location.href = "/events?all=1"; }} />;
}
