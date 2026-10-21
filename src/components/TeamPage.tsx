import "./TeamPage.fi.css";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useState, type ReactNode } from "react";
import { useAttendeeIdentity } from "../lib/demoDayIdentity";
import { useAppreciation } from "../lib/demoDayApi";
import {
  getEventMode,
  isDemoDayMode,
  getEventDisplayLabel,
} from "../lib/eventModes";
import { toast } from "sonner";
import { LoadingState } from "./ui/LoadingState";
import { ErrorState } from "./ui/ErrorState";
import { DirectionIcon, HeartIcon } from "./participation/ParticipationChrome";
import { Link, useNavigate } from "react-router-dom";
import { requestSignIn } from "../lib/signIn";

type ProjectTeam = NonNullable<
  FunctionReturnType<typeof api.teams.getTeamById>
>;
type ProjectEvent = {
  name: string;
  status: string;
  mode?: string;
  venueLocationEnabled?: boolean;
};
type AppreciationData = FunctionReturnType<
  typeof api.appreciations.getSingleTeamAppreciation
>;

export function TeamPage({
  eventId,
  teamId,
}: {
  eventId: Id<"events">;
  teamId: Id<"teams">;
}) {
  const event = useQuery(api.events.getEvent, { eventId });
  const team = useQuery(api.teams.getTeamById, { teamId });
  const navigate = useNavigate();

  if (team === undefined || event === undefined)
    return <LoadingState label="Loading project…" />;
  if (!event || !team || team.eventId !== eventId || team.hidden) {
    return (
      <ErrorState
        title="Project unavailable"
        description="This project is unavailable or you don't have access to its event."
        actionLabel="Back to event"
        onAction={() => void navigate(`/event/${eventId}`)}
      />
    );
  }

  // Appreciation endpoints only support Demo Day. Other formats use their event workflow.
  return isDemoDayMode(event.mode) ? (
    <DemoDayProject key={teamId} event={event} team={team} />
  ) : (
    <TeamPageView event={event} team={team} />
  );
}

function DemoDayProject({
  event,
  team,
}: {
  event: ProjectEvent;
  team: ProjectTeam;
}) {
  const { attendeeId, isLoading } = useAttendeeIdentity();
  const appreciationData = useQuery(
    api.appreciations.getSingleTeamAppreciation,
    {
      eventId: team.eventId,
      teamId: team._id,
      ...(attendeeId ? { attendeeId } : {}),
    },
  );
  if (isLoading || appreciationData === undefined)
    return <LoadingState label="Loading project…" />;
  return (
    <TeamPageView
      event={event}
      team={team}
      appreciationCount={appreciationData.totalCount}
      activity={
        <AppreciationSection
          key={team._id}
          eventId={team.eventId}
          teamId={team._id}
          teamName={team.name}
          attendeeId={attendeeId}
          appreciationData={appreciationData}
          isEventLive={event.status === "active"}
          requestLocation={event.venueLocationEnabled === true}
        />
      }
    />
  );
}

/** Shared project presentation, also used by the sample-data design preview. */
export function TeamPageView({
  event,
  team,
  activity,
  appreciationCount,
  eventHref = `/event/${team.eventId}`,
}: {
  event: ProjectEvent;
  team: Pick<
    ProjectTeam,
    | "eventId"
    | "name"
    | "description"
    | "members"
    | "courseCode"
    | "track"
    | "prizeEntries"
    | "githubUrl"
    | "projectUrl"
  >;
  activity?: ReactNode;
  appreciationCount?: number;
  eventHref?: string;
}) {
  const mode = getEventMode(event.mode);
  const projectTag =
    mode === "hackathon"
      ? team.track?.trim()
      : mode === "demo_day"
        ? team.courseCode?.trim()
        : undefined;
  const tagLabel = mode === "hackathon" ? "Track" : "Course";
  const prizeEntries = mode === "hackathon" ? (team.prizeEntries ?? []) : [];
  const projectUrl = team.projectUrl?.trim();
  const githubUrl = team.githubUrl?.trim();
  const links = [
    { label: "Open project", url: projectUrl },
    { label: "View on GitHub", url: githubUrl },
  ].filter((link) => link.url && /^https?:\/\//i.test(link.url));
  return (
    <article className="project-page">
      <Link to={eventHref} className="project-back">
        <DirectionIcon direction="left" /> Back to event
      </Link>
      <header className="project-heading">
        <div>
          <p className="project-event">
            {event.name} <span aria-hidden="true">·</span>{" "}
            {getEventDisplayLabel(event.mode)}
          </p>
          <h1>{team.name}</h1>
          {prizeEntries.length > 0 ? (
            <div className="project-prize-submissions">
              <p>Entered for</p>
              <ul className="project-prize-tags" aria-label="Prize entries">
                {prizeEntries.map((prize) => (
                  <li key={prize._id} className="project-tag">
                    <span>{prize.name}</span>
                    {prize.automatic && (
                      <span className="project-tag-source">Automatic</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : projectTag ? (
            <span
              className="project-tag"
              aria-label={`${tagLabel}: ${projectTag}`}
            >
              {projectTag}
            </span>
          ) : null}
        </div>
        {appreciationCount !== undefined && (
          <div className="project-appreciation-count">
            <HeartIcon />
            <strong>{appreciationCount}</strong>
            <span>appreciations</span>
          </div>
        )}
      </header>
      <div className="project-layout">
        <section
          className="project-about"
          aria-labelledby="project-about-title"
        >
          <h2 id="project-about-title">About the project</h2>
          <p>
            {team.description.trim() ||
              "The team hasn't added a project description yet."}
          </p>
        </section>
        <aside className="project-sidebar" aria-label="Team and project links">
          {team.members.length > 0 && (
            <section>
              <h2>The team</h2>
              <ul className="project-members">
                {team.members.map((member, index) => (
                  <li key={`${member}-${index}`}>{member}</li>
                ))}
              </ul>
            </section>
          )}
          {links.length > 0 && (
            <section>
              <h2>Explore the work</h2>
              <div className="project-links">
                {links.map((link) => (
                  <a
                    key={link.label}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.label}
                    <DirectionIcon />
                  </a>
                ))}
              </div>
            </section>
          )}
          {activity ? (
            <section className="project-activity">{activity}</section>
          ) : (
            <Link className="project-event-link" to={eventHref}>
              Open event <DirectionIcon />
            </Link>
          )}
        </aside>
      </div>
    </article>
  );
}

function AppreciationSection({
  eventId,
  teamId,
  teamName,
  attendeeId,
  appreciationData,
  isEventLive,
  requestLocation,
}: {
  eventId: Id<"events">;
  teamId: Id<"teams">;
  teamName: string;
  attendeeId: string | null;
  appreciationData: AppreciationData;
  isEventLive: boolean;
  requestLocation: boolean;
}) {
  const { appreciate, isLoading, isAuthenticated } = useAppreciation();
  const [pending, setPending] = useState(false);
  const [receipt, setReceipt] = useState<{
    count: number;
    remaining: number;
  } | null>(null);
  const attendeeCount = Math.max(
    appreciationData.attendeeCount,
    receipt?.count ?? 0,
  );
  const remainingBudget = Math.min(
    appreciationData.attendeeRemainingBudget,
    receipt?.remaining ?? Infinity,
  );
  const maxPerTeam = appreciationData.maxPerTeam;
  const canAppreciate =
    isEventLive &&
    !!attendeeId &&
    attendeeCount < maxPerTeam &&
    remainingBudget > 0;
  const signedOut = isAuthenticated === false;

  const handleAppreciate = async () => {
    if (signedOut) {
      requestSignIn();
      return;
    }
    if (!canAppreciate || pending || isLoading) return;
    setPending(true);
    try {
      const result = await appreciate(eventId, teamId, undefined, undefined, {
        requestLocation,
      });
      if (result.success) {
        setReceipt({
          count: maxPerTeam - result.remainingForTeam,
          remaining: result.remainingTotal,
        });
        toast.success(`Appreciation sent to ${teamName}.`);
      } else {
        toast.error(
          result.error ||
            "Your appreciation could not be sent. Please try again.",
        );
      }
    } finally {
      setPending(false);
    }
  };

  const label = !isEventLive
    ? "Appreciations closed"
    : signedOut
      ? "Sign in to appreciate"
      : attendeeCount >= maxPerTeam
        ? "Project limit reached"
        : remainingBudget <= 0
          ? "No appreciations left"
          : "Give appreciation";
  return (
    <div className="project-appreciation">
      <h2>Show your appreciation</h2>
      <p>
        {remainingBudget} left to share across the event. Up to {maxPerTeam} per
        project.
      </p>
      <button
        type="button"
        onClick={() => void handleAppreciate()}
        disabled={
          pending || isLoading || !isEventLive || (!signedOut && !canAppreciate)
        }
      >
        <HeartIcon />
        {pending || isLoading ? "Sending…" : label}
      </button>
      <p className="project-appreciation-progress" aria-live="polite">
        {attendeeCount} / {maxPerTeam} given to this project
      </p>
    </div>
  );
}
