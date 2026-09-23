import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAttendeeIdentity } from "../../lib/demoDayIdentity";
import { useAppreciation } from "../../lib/demoDayApi";
import { toast } from "sonner";
import { LoadingState } from "../ui/LoadingState";
import { ProjectArt } from "../home/EventStage";
import {
  ParticipationFrame,
  ParticipationHeader,
  HeartIcon,
  DirectionIcon,
} from "../participation/ParticipationChrome";

type DemoTeam = {
  _id: Id<"teams">;
  name: string;
  description: string;
  members?: string[];
  courseCode?: string;
  hidden?: boolean;
};
type DemoDayBrowseProps = {
  eventId: Id<"events">;
  event: {
    name: string;
    description: string;
    startDate: number;
    endDate: number;
    status: string;
    venueLocationEnabled?: boolean;
    teams: DemoTeam[];
  };
  onBack: () => void;
};
export type AppreciationData = FunctionReturnType<
  typeof api.appreciations.getTeamAppreciations
>;
export type AppreciationController = ReturnType<typeof useAppreciation>;

export function DemoDayBrowse(props: DemoDayBrowseProps) {
  const { attendeeId, isLoading } = useAttendeeIdentity();
  const appreciationData = useQuery(api.appreciations.getTeamAppreciations, {
    eventId: props.eventId,
  });
  const appreciation = useAppreciation();
  return (
    <ParticipationFrame mode="demo_day">
      {isLoading ? (
        <LoadingState label="Initializing..." />
      ) : (
        <DemoDayBrowseView
          key={props.eventId}
          {...props}
          attendeeId={attendeeId}
          appreciationData={appreciationData}
          appreciation={appreciation}
        />
      )}
    </ParticipationFrame>
  );
}

export function DemoDayBrowseView({
  eventId,
  event,
  onBack,
  attendeeId,
  appreciationData,
  appreciation,
  preview = false,
}: DemoDayBrowseProps & {
  attendeeId: string | null;
  appreciationData: AppreciationData | undefined;
  appreciation: AppreciationController;
  preview?: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [course, setCourse] = useState<string | null>(null);
  const [confirmedBudget, setConfirmedBudget] = useState<number | null>(null);
  const [confirmedCounts, setConfirmedCounts] = useState<
    Record<string, number>
  >({});
  const [pendingTeam, setPendingTeam] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    setConfirmedBudget(null);
    setConfirmedCounts({});
  }, [appreciationData]);
  const maxPerAttendee = appreciationData?.maxPerAttendee ?? 100;
  const maxPerTeam = appreciationData?.maxPerTeam ?? 10;
  const remainingBudget = Math.min(
    appreciationData?.attendeeRemainingBudget ?? maxPerAttendee,
    confirmedBudget ?? maxPerAttendee,
  );
  const visibleTeams = useMemo(
    () => event.teams.filter((team) => !team.hidden),
    [event.teams],
  );
  const courses = useMemo(
    () =>
      [
        ...new Set(
          visibleTeams
            .map((team) => team.courseCode)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [visibleTeams],
  );
  const filteredTeams = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return visibleTeams.filter(
      (team) =>
        (!course || team.courseCode === course) &&
        (!query ||
          [team.name, team.description, ...(team.members ?? [])].some((text) =>
            text.toLowerCase().includes(query),
          )),
    );
  }, [visibleTeams, course, searchQuery]);
  const counts = useMemo(
    () =>
      new Map(
        appreciationData?.teams.map((team) => [
          String(team.teamId),
          team.attendeeCount,
        ]) ?? [],
      ),
    [appreciationData],
  );
  const live = event.status === "active";

  const appreciateTeam = async (team: DemoTeam) => {
    if (appreciation.isAuthenticated === false) {
      window.dispatchEvent(new CustomEvent("hackjudge:open-signin"));
      return;
    }
    const count = Math.max(
      counts.get(team._id) ?? 0,
      confirmedCounts[team._id] ?? 0,
    );
    if (
      !live ||
      !attendeeId ||
      pendingTeam ||
      appreciation.isLoading ||
      remainingBudget <= 0 ||
      count >= maxPerTeam
    )
      return;
    setPendingTeam(team._id);
    try {
      const result = await appreciation.appreciate(
        eventId,
        team._id,
        undefined,
        undefined,
        { requestLocation: event.venueLocationEnabled === true },
      );
      if (result.success) {
        setConfirmedBudget(result.remainingTotal);
        setConfirmedCounts((current) => ({
          ...current,
          [team._id]: maxPerTeam - result.remainingForTeam,
        }));
        setNotice(
          `Love Tap sent to ${team.name}. ${result.remainingTotal} left to share.`,
        );
      } else {
        const message =
          result.error || "Your Love Tap could not be sent. Please try again.";
        setNotice(message);
        toast.error(message);
      }
    } finally {
      setPendingTeam(null);
    }
  };

  return (
    <div className="participation-content demo-browse">
      <ParticipationHeader
        title={event.name}
        description={
          event.description ||
          "Meet the projects and share a little appreciation."
        }
        onBack={onBack}
        aside={
          <div className="demo-budget">
            <HeartIcon />
            <div>
              <strong>{remainingBudget}</strong>
              <span>Love Taps left</span>
            </div>
            <p>
              Up to {maxPerTeam} per project.
              <br />
              {maxPerAttendee} to share across the event.
            </p>
          </div>
        }
      />
      {!live && (
        <p className="participation-notice">
          {event.status === "past"
            ? "This event has ended. You can still explore the projects."
            : "Appreciations open once the event is live."}
        </p>
      )}
      <div className="demo-toolbar">
        <label className="participation-search">
          <span>Find a project</span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects by name or description..."
          />
        </label>
        {courses.length > 0 && (
          <div
            className="demo-courses"
            role="group"
            aria-label="Filter by course"
          >
            <button aria-pressed={!course} onClick={() => setCourse(null)}>
              All Courses
            </button>
            {courses.map((code) => (
              <button
                key={code}
                aria-pressed={course === code}
                onClick={() => setCourse(course === code ? null : code)}
              >
                {code}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="participation-section-title">
        <h2>Explore the projects</h2>
        <span>
          {filteredTeams.length} project{filteredTeams.length === 1 ? "" : "s"}
          {course ? ` in ${course}` : ""}
        </span>
      </div>
      <p className="demo-live-notice" role="status">
        {notice || "Found something you love? Send the team a Love Tap."}
      </p>
      {filteredTeams.length === 0 ? (
        <div className="participation-empty">
          <h3>No Projects Found</h3>
          <p>Try another search or course.</p>
        </div>
      ) : (
        <div className="demo-project-grid">
          {filteredTeams.map((team) => {
            const count = Math.max(
              counts.get(team._id) ?? 0,
              confirmedCounts[team._id] ?? 0,
            );
            const blocked =
              !live ||
              (!attendeeId && appreciation.isAuthenticated !== false) ||
              count >= maxPerTeam ||
              remainingBudget <= 0 ||
              !!pendingTeam ||
              appreciation.isLoading;
            return (
              <article className="demo-project" key={team._id}>
                <div className="demo-project-art">
                  <ProjectArt index={visibleTeams.indexOf(team)} />
                  {team.courseCode && <span>{team.courseCode}</span>}
                </div>
                <div className="demo-project-content">
                  <h3>
                    {preview ? (
                      team.name
                    ) : (
                      <Link to={`/event/${eventId}/team/${team._id}`}>
                        {team.name}
                      </Link>
                    )}
                  </h3>
                  <p>{team.description || "No description yet."}</p>
                  <details className="demo-project-details">
                    <summary>Project details</summary>
                    {team.members?.length ? (
                      <p>{team.members.join(" · ")}</p>
                    ) : (
                      <p>Team members have not been listed.</p>
                    )}
                    {!preview && (
                      <Link to={`/event/${eventId}/team/${team._id}`}>
                        Open project page <DirectionIcon />
                      </Link>
                    )}
                  </details>
                  <div className="demo-project-actions">
                    <span>
                      {count} / {maxPerTeam} sent
                    </span>
                    <button
                      className="demo-love-tap"
                      onClick={() => void appreciateTeam(team)}
                      disabled={blocked}
                      aria-label={`Send Love Tap to ${team.name}`}
                    >
                      <HeartIcon />
                      {pendingTeam === team._id
                        ? "Sending..."
                        : appreciation.isAuthenticated === false
                          ? "Sign in to vote"
                          : !live
                            ? "Voting closed"
                            : count >= maxPerTeam
                              ? "Limit reached"
                              : remainingBudget <= 0
                                ? "None left"
                                : "Love Tap +1"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <div className="demo-mobile-budget">
        <HeartIcon />
        <strong>{remainingBudget}</strong> Love Taps left{" "}
        <span>Up to {maxPerTeam} per project</span>
      </div>
    </div>
  );
}
