import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { useAttendeeIdentity } from "../lib/demoDayIdentity";
import { useAppreciation } from "../lib/demoDayApi";
import { toast } from "sonner";
import { LoadingState } from "./ui/LoadingState";
import { ErrorState } from "./ui/ErrorState";
import { Link } from "react-router-dom";

interface TeamPageProps {
  eventId: Id<"events">;
  teamId: Id<"teams">;
}

export function TeamPage({ eventId, teamId }: TeamPageProps) {
  // Get attendee identity
  const { attendeeId, isLoading: identityLoading } = useAttendeeIdentity();

  // Fetch event status to gate appreciations
  const event = useQuery(api.events.getEvent, { eventId });

  // Fetch team data
  const team = useQuery(api.teams.getTeamById, { teamId });

  // Fetch appreciation data
  const appreciationData = useQuery(
    api.appreciations.getSingleTeamAppreciation,
    attendeeId ? { eventId, teamId, attendeeId } : { eventId, teamId }
  );

  if (identityLoading || team === undefined || appreciationData === undefined || event === undefined) {
    return <LoadingState label="Loading project..." />;
  }

  if (team === null) {
    return (
      <ErrorState
        title="Project Not Found"
        description="This project doesn't exist or has been removed."
        actionLabel="Browse All Projects"
        onAction={() => window.location.href = `/event/${eventId}`}
      />
    );
  }

  if (team.hidden) {
    return (
      <ErrorState
        title="Project Unavailable"
        description="This project is currently not available for viewing."
        actionLabel="Browse All Projects"
        onAction={() => window.location.href = `/event/${eventId}`}
      />
    );
  }

  if (event === null) {
    return (
      <ErrorState
        title="Event Not Found"
        description="The event for this project is unavailable."
        actionLabel="Browse All Projects"
        onAction={() => window.location.href = `/event/${eventId}`}
      />
    );
  }

  const isEventLive = event.status === "active";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Link */}
      <Link
        to={`/event/${eventId}`}
        className="inline-flex items-center gap-2 btn-ghost mb-6 text-sm"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        Browse All Projects
      </Link>

      {/* Main Card */}
      <div className="card-static bg-card overflow-hidden">
        {/* Header with appreciation count */}
        <div className="bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-8 text-white">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {team.courseCode && (
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-sm font-medium rounded-full">
                    {team.courseCode}
                  </span>
                </div>
              )}
              <h1 className="text-2xl sm:text-3xl font-heading font-bold mb-2">
                {team.name}
              </h1>
              <p className="text-white/80 text-sm">
                {team.event.name}
              </p>
            </div>
            <div className="flex flex-col items-center bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3">
              <span className="text-3xl mb-1">❤️</span>
              <span className="text-2xl font-bold">{appreciationData.totalCount}</span>
              <span className="text-xs text-white/80">appreciations</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Description */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              About This Project
            </h2>
            <p className="text-foreground leading-relaxed">
              {team.description}
            </p>
          </div>

          {/* Team Members */}
          {team.members.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Team Members
              </h2>
              <div className="flex flex-wrap gap-2">
                {team.members.map((member, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1.5 bg-muted text-foreground text-sm rounded-full"
                  >
                    {member}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* GitHub Link */}
          {team.githubUrl && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Project Link
              </h2>
              <a
                href={team.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                View on GitHub
              </a>
            </div>
          )}
        </div>

        {/* Appreciation Section */}
        <div className="border-t border-border p-6 bg-muted/30">
          <AppreciationSection
            eventId={eventId}
            teamId={teamId}
            teamName={team.name}
            attendeeId={attendeeId}
            appreciationData={appreciationData}
            isEventLive={isEventLive}
          />
        </div>
      </div>
    </div>
  );
}

interface AppreciationSectionProps {
  eventId: Id<"events">;
  teamId: Id<"teams">;
  teamName: string;
  attendeeId: string | null;
  appreciationData: {
    totalCount: number;
    attendeeCount: number;
    attendeeTotalCount: number;
    attendeeRemainingBudget: number;
    maxPerAttendee: number;
    maxPerTeam: number;
  };
  isEventLive: boolean;
}

function AppreciationSection({
  eventId,
  teamId,
  teamName,
  attendeeId,
  appreciationData,
  isEventLive,
}: AppreciationSectionProps) {
  const { appreciate, isLoading } = useAppreciation();
  const [optimisticCount, setOptimisticCount] = useState<number | null>(null);

  const attendeeCount = optimisticCount ?? appreciationData.attendeeCount;
  const maxPerTeam = appreciationData.maxPerTeam ?? 3;
  const maxPerAttendee = appreciationData.maxPerAttendee ?? 100;
  const remainingBudget =
    appreciationData.attendeeRemainingBudget -
    (optimisticCount !== null ? 1 : 0);
  const canAppreciate =
    isEventLive && attendeeId && attendeeCount < maxPerTeam && remainingBudget > 0;

  const handleAppreciate = async () => {
    if (!attendeeId || !canAppreciate) return;

    // Optimistic update
    setOptimisticCount((prev) => (prev ?? appreciationData.attendeeCount) + 1);

    const result = await appreciate(
      eventId,
      teamId,
      () => {
        toast.success(`Appreciated ${teamName}! ❤️`);
      },
      (error) => {
        // Revert optimistic update
        setOptimisticCount(null);
        toast.error(error);
      }
    );

    // If successful, the query will refresh and we can clear optimistic state
    if (result.success) {
      setTimeout(() => setOptimisticCount(null), 500);
    }
  };

  return (
    <div className="text-center">
      <h2 className="text-lg font-heading font-semibold text-foreground mb-2">
        Show Your Appreciation
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        You can give up to {maxPerTeam} appreciations to this project.
        You have <span className="font-semibold text-foreground">{remainingBudget}</span> of {maxPerAttendee} remaining overall.
      </p>
      {!isEventLive && (
        <p className="text-sm text-amber-600 dark:text-amber-400 font-medium mb-3">
          Appreciations open once the event is live.
        </p>
      )}

      {/* Progress indicator */}
      <div className="flex justify-center items-center gap-2 mb-4">
        {[...Array(maxPerTeam)].map((_, i) => (
          <div
            key={i}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${i < attendeeCount
              ? "bg-pink-500 text-white scale-110"
              : "bg-muted text-muted-foreground"
              }`}
          >
            ❤️
          </div>
        ))}
      </div>

      <button
        onClick={handleAppreciate}
        disabled={!canAppreciate || isLoading}
        className={`
          inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-lg
          ${canAppreciate
            ? "bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white hover:shadow-xl hover:scale-105 active:scale-100"
            : "bg-muted text-muted-foreground cursor-not-allowed shadow-none"
          }
          ${isLoading ? "opacity-70" : ""}
        `}
      >
        {isLoading ? (
          <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg
            className="w-6 h-6"
            fill={canAppreciate ? "currentColor" : "none"}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        )}
        {!isEventLive
          ? "Opens when live"
          : attendeeCount >= maxPerTeam
            ? "Max Appreciations Given"
            : remainingBudget <= 0
              ? "No Appreciations Left"
              : "Give Appreciation"}
      </button>

      {attendeeCount > 0 && (
        <p className="text-sm text-pink-500 mt-3 font-medium">
          You've given {attendeeCount} appreciation{attendeeCount !== 1 ? "s" : ""} to this project!
        </p>
      )}
    </div>
  );
}
