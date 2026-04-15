import { useMutation, useQuery } from "convex/react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Reorder } from "framer-motion";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { SignInForm } from "../../SignInFormNew";
import { formatDateTime } from "../../lib/utils";
import { MedalIcon, TrophyIcon } from "../ui/AppIcons";
import { LoadingState } from "../ui/LoadingState";

type CodeAndTellEvent = {
  name: string;
  description: string;
  startDate: number;
  endDate: number;
  status: "upcoming" | "active" | "past";
  resultsReleased?: boolean;
  teams: Array<{
    _id: Id<"teams">;
    name: string;
    description: string;
    members?: string[];
    projectUrl?: string;
    githubUrl?: string;
  }>;
};

type Project = {
  _id: Id<"teams">;
  name: string;
  description: string;
  members: string[];
  projectUrl?: string;
  entrantEmails: string[];
  isOwned: boolean;
  isEligible: boolean;
};

type PublicResults = {
  winnerTeamId: Id<"teams"> | null;
  totalBallots: number;
  standings: Array<{
    teamId: Id<"teams">;
    name: string;
    description: string;
    projectUrl?: string;
    points: number;
    ballotsCount: number;
    rankCounts: number[];
  }>;
};

function BallotSlot({
  index,
  project,
  onRemove,
}: {
  index: number;
  project?: Project;
  onRemove: () => void;
}) {
  if (!project) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/15 p-4 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-current/15 bg-background text-sm font-bold text-amber-600 dark:text-amber-400">
              #{index + 1}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Rank {index + 1}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Pick a project for this slot.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Reorder.Item
      value={project._id}
      id={project._id}
      className="rounded-2xl border border-border bg-card p-4 transition-colors shadow-sm cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-current/15 bg-background text-sm font-bold text-amber-600 dark:text-amber-400">
            #{index + 1}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Rank {index + 1}
            </div>
            <div className="mt-1 truncate text-base font-semibold text-foreground">
              {project.name}
            </div>
            <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {project.description || "No description"}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg border border-red-500/20 px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
          >
            Remove
          </button>
        </div>
      </div>
    </Reorder.Item>
  );
}

function ResultsSection({
  event,
  results,
}: {
  event: CodeAndTellEvent;
  results: PublicResults;
}) {
  const winner =
    (results?.winnerTeamId &&
      results.standings.find(
        (row) => String(row.teamId) === String(results.winnerTeamId),
      )) ||
    (results?.winnerTeamId
      ? event.teams.find(
          (team) => String(team._id) === String(results.winnerTeamId),
        )
      : null);

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-amber-500/25 bg-[linear-gradient(140deg,rgba(245,158,11,0.16),rgba(251,191,36,0.05),transparent_65%)] p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-background/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">
              <TrophyIcon className="h-4 w-4" />
              Results Released
            </div>
            <div>
              <h2 className="text-3xl font-heading font-bold text-foreground">
                {winner?.name || "Winner"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {winner?.description ||
                  "Final Code & Tell winner selected from ranked ballots."}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-border bg-background/80 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Ballots
              </div>
              <div className="mt-1 text-2xl font-bold text-foreground">
                {results.totalBallots}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-background/80 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Published
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                Ranked summary
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-5">
          <h3 className="text-xl font-heading font-bold text-foreground">
            Top Standings
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Totals use K-Borda points per ballot (K for 1st, then K−1… down to 1).
            Ties use more 1st-place finishes, then 2nd, and so on, then name.
          </p>
        </div>
        {results.standings.length === 0 ? (
          <div className="px-6 py-8 text-sm text-muted-foreground">
            No valid ballots were counted for this event.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {results.standings.map((row, index) => (
              <div
                key={row.teamId}
                className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/30 text-sm font-bold text-foreground">
                    #{index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-base font-semibold text-foreground">
                        {row.name}
                      </div>
                      {index < 3 && (
                        <MedalIcon className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                    <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {row.description || "No description"}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm md:min-w-[18rem]">
                  <div className="rounded-xl border border-border bg-background px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Points
                    </div>
                    <div className="mt-1 font-semibold text-foreground">
                      {row.points}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-background px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Ballots
                    </div>
                    <div className="mt-1 font-semibold text-foreground">
                      {row.ballotsCount}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-background px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      1st Place
                    </div>
                    <div className="mt-1 font-semibold text-foreground">
                      {row.rankCounts[0] || 0}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CodeAndTellVoteView({
  eventId,
  event,
  onBack,
}: {
  eventId: Id<"events">;
  event: CodeAndTellEvent;
  onBack: () => void;
}) {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const publicResults = useQuery(
    api.codeAndTell.getPublicResults,
    event.resultsReleased ? { eventId } : "skip",
  );
  const saveBallot = useMutation(api.codeAndTell.saveBallot);

  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [rankedTeamIds, setRankedTeamIds] = useState<Id<"teams">[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const hasVerifiedEmail = Boolean(loggedInUser?.email?.trim());
  const votingContext = useQuery(
    api.codeAndTell.getVotingContext,
    event.status === "active" && loggedInUser && hasVerifiedEmail
      ? { eventId }
      : "skip",
  );

  const ballotSignature = useMemo(
    () => (votingContext?.currentBallotTeamIds || []).join(":"),
    [votingContext?.currentBallotTeamIds],
  );

  useEffect(() => {
    if (votingContext) {
      setRankedTeamIds(votingContext.currentBallotTeamIds || []);
    }
  }, [ballotSignature, votingContext]);

  const projectById = useMemo(() => {
    return new Map(
      (votingContext?.projects || []).map((project) => [String(project._id), project]),
    );
  }, [votingContext?.projects]);

  const rankedProjectSet = useMemo(
    () => new Set(rankedTeamIds.map((teamId) => String(teamId))),
    [rankedTeamIds],
  );

  const filteredProjects = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    const projects = votingContext?.projects || [];
    if (!query) return projects;
    return projects.filter((project) => {
      return (
        project.name.toLowerCase().includes(query) ||
        project.description.toLowerCase().includes(query) ||
        project.members.some((member) => member.toLowerCase().includes(query))
      );
    });
  }, [deferredSearchQuery, votingContext?.projects]);

  const requiredRankCount = votingContext?.requiredRankCount || 0;
  const ballotComplete =
    requiredRankCount > 0 && rankedTeamIds.length === requiredRankCount;
  const remainingSlots = Math.max(requiredRankCount - rankedTeamIds.length, 0);
  const votingClosedToNewVoters =
    votingContext?.votingClosedToNewVoters ?? false;

  const currentSignature = useMemo(
    () => rankedTeamIds.join(":"),
    [rankedTeamIds]
  );
  const hasUnsavedChanges = currentSignature !== ballotSignature;
  const isSaved = ballotComplete && !hasUnsavedChanges && (votingContext?.currentBallotTeamIds?.length === requiredRankCount);

  const addProjectToBallot = (teamId: Id<"teams">) => {
    setRankedTeamIds((current) => {
      if (current.includes(teamId) || current.length >= requiredRankCount) {
        return current;
      }
      return [...current, teamId];
    });
  };

  const [isMobileBallotOpen, setIsMobileBallotOpen] = useState(false);

  const renderBallot = () => (
    <div className="card p-5 bg-muted/30 h-full flex flex-col">
      <div className="border-b border-border pb-4 shrink-0">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Your Ballot
        </div>
        <h2 className="mt-2 text-xl font-heading font-bold text-foreground">
          Rank {requiredRankCount} project{requiredRankCount === 1 ? "" : "s"}
        </h2>
      </div>

      <div className="mt-5 space-y-3 flex-1 overflow-y-auto min-h-[200px] custom-scrollbar pr-2">
        <Reorder.Group
          axis="y"
          values={rankedTeamIds}
          onReorder={setRankedTeamIds}
          className="space-y-3"
        >
          {rankedTeamIds.map((teamId, index) => {
            const project = projectById.get(String(teamId));
            return (
              <BallotSlot
                key={teamId}
                index={index}
                project={project}
                onRemove={() => removeProjectFromBallot(teamId)}
              />
            );
          })}
        </Reorder.Group>
        
        {Array.from({ length: Math.max(0, requiredRankCount - rankedTeamIds.length) }, (_, i) => {
          const index = rankedTeamIds.length + i;
          return (
            <BallotSlot
              key={`empty-${index}`}
              index={index}
              onRemove={() => {}}
            />
          );
        })}
      </div>

      <div className="shrink-0 pt-4 mt-auto">
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          isSaved 
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100" 
            : "border-border bg-background text-muted-foreground"
        }`}>
          {isSaved
            ? "Your ballot is safely stored."
            : ballotComplete
              ? hasUnsavedChanges && votingContext?.currentBallotTeamIds?.length === requiredRankCount
                ? "You have unsaved changes."
                : "Your ballot is complete and ready to save."
              : `${remainingSlots} slot${remainingSlots === 1 ? "" : "s"} still open.`}
        </div>

        <button
          type="button"
          onClick={() => void handleSaveBallot()}
          disabled={
            !ballotComplete ||
            isSubmitting ||
            votingClosedToNewVoters ||
            !hasUnsavedChanges
          }
          className={`mt-5 w-full py-2.5 rounded-lg font-semibold transition-colors ${
            isSaved
              ? "bg-emerald-500 text-white opacity-100"
              : "btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          }`}
        >
          {isSubmitting ? "Saving ballot..." : isSaved ? "✓ Ballot Submitted" : "Save Ballot"}
        </button>

        <div className="mt-3 text-xs text-center text-muted-foreground">
          {lastSavedAt
            ? `Last saved at ${new Date(lastSavedAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}`
            : votingContext?.currentBallotTeamIds && votingContext.currentBallotTeamIds.length > 0
              ? "Existing ballot loaded. You can replace it until the event ends."
              : "No ballot saved yet."}
        </div>
      </div>
    </div>
  );

  const removeProjectFromBallot = (teamId: Id<"teams">) => {
    setRankedTeamIds((current) => current.filter((id) => id !== teamId));
  };

  const moveBallotProject = (index: number, direction: -1 | 1) => {
    setRankedTeamIds((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  };

  const handleSaveBallot = async () => {
    if (!ballotComplete) {
      toast.error(
        `Rank exactly ${requiredRankCount} project${
          requiredRankCount === 1 ? "" : "s"
        } before saving.`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await saveBallot({ eventId, rankedTeamIds });
      setLastSavedAt(Date.now());
      toast.success("Ballot saved");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save ballot");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (event.resultsReleased) {
    if (publicResults === undefined) {
      return <LoadingState label="Loading results..." />;
    }

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 btn-ghost"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Events
        </button>

        <div className="mb-8 rounded-3xl border border-border bg-card px-6 py-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                Code &amp; Tell
              </div>
              <h1 className="mt-3 text-3xl font-heading font-bold text-foreground">
                {event.name}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                {event.description}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              {formatDateTime(event.startDate).split(',')[0]}
            </div>
          </div>
        </div>

        {publicResults ? (
          <ResultsSection event={event} results={publicResults} />
        ) : (
          <div className="rounded-3xl border border-border bg-card px-6 py-8 text-sm text-muted-foreground">
            Results have not been published yet.
          </div>
        )}
      </div>
    );
  }

  if (event.status === "upcoming") {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 btn-ghost"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Events
        </button>
        <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <TrophyIcon className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-3xl font-heading font-bold text-foreground">
            {event.name}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Voting opens when the event becomes active. Projects are already managed by admins, and ranked ballots will unlock at the scheduled start time.
          </p>
        </div>
      </div>
    );
  }

  if (event.status === "past") {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 btn-ghost"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Events
        </button>
        <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Code &amp; Tell
          </div>
          <h1 className="mt-4 text-3xl font-heading font-bold text-foreground">
            Results Pending
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Balloting is closed. Admins still need to confirm the final winner and release the ranked-vote results.
          </p>
        </div>
      </div>
    );
  }

  if (loggedInUser === undefined) {
    return <LoadingState label="Loading voting access..." />;
  }

  if (!loggedInUser) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 btn-ghost"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Events
        </button>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_24rem]">
          <div className="rounded-3xl border border-amber-500/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),transparent_72%)] p-8 shadow-sm">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-background/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
              Code &amp; Tell Ballot
            </div>
            <h1 className="mt-4 text-3xl font-heading font-bold text-foreground">
              Sign in to vote
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Code &amp; Tell uses one editable ranked ballot per signed-in voter. Your own projects stay visible, but they cannot be placed in your ranking.
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-heading font-bold text-foreground">
              Sign In
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Use your event account to unlock ballot editing.
            </p>
            <div className="mt-6">
              <SignInForm />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!hasVerifiedEmail) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 btn-ghost"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Events
        </button>
        <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-8 text-sm text-red-700 dark:text-red-300 shadow-sm">
          A verified account email is required to vote in Code &amp; Tell events.
        </div>
      </div>
    );
  }

  if (votingContext === undefined) {
    return <LoadingState label="Loading ballot..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 btn-ghost"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        Back to Events
      </button>

      <div className="mb-8 fade-in space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-heading font-bold text-foreground">
              {event.name}
            </h1>
            <span className="badge bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
              Code & Tell
            </span>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {event.description}
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pt-1">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDateTime(event.startDate).split(',')[0]}
            </span>
          </div>
        </div>
      </div>

      {votingContext && votingClosedToNewVoters && (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          This event has reached its voting limit for new voters (
          {votingContext.rankedVoteRowCount}
          {votingContext.maxBallots != null
            ? ` / ${votingContext.maxBallots}`
            : ""}
          ). If you already had a ballot, you can still update it; otherwise
          contact an organizer.
        </div>
      )}

      {isSaved && (
        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100 flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div>
            <div className="font-semibold">You're all set!</div>
            <div>Your ballot is submitted. You can still make changes until the event ends.</div>
          </div>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-6 pb-24 xl:pb-0">
        <div className="flex-1 space-y-5">
          <div className="card p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-heading font-bold text-foreground">
                  Project Field
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Search all visible projects, then add eligible ones into your ranking.
                </p>
              </div>
              <div className="lg:w-80">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search projects, descriptions, or members..."
                  className="input w-full"
                />
              </div>
            </div>
          </div>

          {votingContext.eligibleProjectCount === 0 ? (
            <div className="card p-8 border-dashed text-sm text-muted-foreground text-center">
              You do not have any eligible projects to rank in this event.
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="card p-8 border-dashed text-sm text-muted-foreground text-center">
              No projects match that search.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProjects.map((project) => {
                const selectedIndex = rankedTeamIds.findIndex(
                  (teamId) => String(teamId) === String(project._id),
                );

                return (
                  <ProjectListItem
                    key={project._id}
                    project={project}
                    selectedIndex={selectedIndex}
                    votingClosedToNewVoters={votingClosedToNewVoters}
                    rankedProjectSet={rankedProjectSet}
                    rankedTeamIdsLength={rankedTeamIds.length}
                    requiredRankCount={requiredRankCount}
                    removeProjectFromBallot={removeProjectFromBallot}
                    addProjectToBallot={addProjectToBallot}
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className="hidden xl:block w-96 shrink-0 sticky top-24 h-fit">
          {renderBallot()}
        </div>
      </div>

      {/* Mobile Ballot Floating Button & Drawer */}
      <div className="xl:hidden">
        {/* Floating Button */}
        <div className="fixed bottom-0 inset-x-0 z-[60] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0.75rem))] pt-2 pointer-events-none">
          <button
            onClick={() => setIsMobileBallotOpen(true)}
            className={`pointer-events-auto w-fit mx-auto border rounded-full shadow-[0_12px_28px_rgba(0,0,0,0.22)] dark:shadow-[0_12px_28px_rgba(0,0,0,0.32)] px-5 py-3 flex items-center justify-center gap-3 font-semibold text-sm transition-colors ${
              isSaved
                ? "bg-emerald-500 text-white border-emerald-500"
                : "bg-primary text-primary-foreground border-primary"
            }`}
          >
            <span>{isSaved ? "✓ Ballot Submitted" : "Your Ballot"}</span>
            <span className="bg-background/20 px-2 py-0.5 rounded-full text-xs">
              {rankedTeamIds.length} / {requiredRankCount}
            </span>
          </button>
        </div>

        {/* Backdrop */}
        {isMobileBallotOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-[70]"
            onClick={() => setIsMobileBallotOpen(false)}
          />
        )}

        {/* Drawer */}
        <div
          className={`fixed inset-x-0 bottom-0 z-[80] bg-card rounded-t-2xl shadow-2xl border border-border p-4 max-h-[85vh] flex flex-col transition-transform duration-300 ease-out will-change-transform ${
            isMobileBallotOpen ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="w-12 h-1.5 bg-muted-foreground/40 rounded-full mx-auto mb-3 shrink-0" />
          <div className="flex items-start justify-between mb-3 gap-2 shrink-0">
            <h3 className="text-lg font-heading font-semibold text-foreground">
              Your Ballot
            </h3>
            <button
              onClick={() => setIsMobileBallotOpen(false)}
              className="text-muted-foreground hover:text-foreground text-2xl -mt-2 mr-2"
              aria-label="Close ballot"
            >
              ✕
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar -mx-4 px-4 pb-4">
            {renderBallot()}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectListItem({
  project,
  selectedIndex,
  votingClosedToNewVoters,
  rankedProjectSet,
  rankedTeamIdsLength,
  requiredRankCount,
  removeProjectFromBallot,
  addProjectToBallot,
}: {
  project: any;
  selectedIndex: number;
  votingClosedToNewVoters: boolean;
  rankedProjectSet: Set<string>;
  rankedTeamIdsLength: number;
  requiredRankCount: number;
  removeProjectFromBallot: (id: Id<"teams">) => void;
  addProjectToBallot: (id: Id<"teams">) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`card p-4 transition-colors ${
        project.isOwned
          ? "border-amber-500/20 bg-amber-500/5"
          : selectedIndex >= 0
            ? "border-teal-500/25 bg-teal-500/5"
            : "hover:border-amber-500/20"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div 
            className="flex justify-between items-start cursor-pointer sm:cursor-auto"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex flex-wrap items-center gap-2 pr-4 sm:pr-0">
              <h3 className="text-base font-semibold text-foreground">
                {project.name}
              </h3>
              {project.isOwned && (
                <span className="badge bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  Your project
                </span>
              )}
              {selectedIndex >= 0 && (
                <span className="badge bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                  Ranked #{selectedIndex + 1}
                </span>
              )}
            </div>
            {/* Mobile expand icon */}
            <button className="sm:hidden text-muted-foreground p-1 shrink-0">
              <svg 
                className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-180" : ""}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          
          <div className={`${isExpanded ? "block" : "hidden sm:block"}`}>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {project.description || "No description"}
            </p>
            {project.members.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {project.members.join(" • ")}
              </p>
            )}
            {project.projectUrl && project.projectUrl.trim() !== "" && (
              <a
                href={project.projectUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                View project
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7m0 0v7m0-7L10 14" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5v14h14" />
                </svg>
              </a>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center mt-2 sm:mt-0">
          {project.isOwned ? (
            <div className="badge bg-muted text-muted-foreground border border-border">
              Ineligible
            </div>
          ) : selectedIndex >= 0 ? (
            <button
              type="button"
              onClick={() => removeProjectFromBallot(project._id)}
              className="btn-ghost text-xs px-3 py-1.5"
            >
              Remove
            </button>
          ) : (
            <button
              type="button"
              onClick={() => addProjectToBallot(project._id)}
              disabled={
                votingClosedToNewVoters ||
                rankedProjectSet.has(String(project._id)) ||
                rankedTeamIdsLength >= requiredRankCount
              }
              className="btn-secondary text-xs px-3 py-1.5"
            >
              Add to ballot
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
