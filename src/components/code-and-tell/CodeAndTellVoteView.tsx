import "./CodeAndTellVoteView.fi.css";
import { useMutation, useQuery } from "convex/react";
import { useDeferredValue, useEffect, useMemo, useState, useRef } from "react";
import type { FunctionReturnType } from "convex/server";
import {
  ParticipationFrame,
  ParticipationHeader,
  DirectionIcon,
} from "../participation/ParticipationChrome";
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
  onMove,
  last,
}: {
  index: number;
  project?: Project;
  onRemove: () => void;
  onMove?: (direction: -1 | 1) => void;
  last?: boolean;
}) {
  if (!project)
    return (
      <li className="ballot-slot ballot-slot--empty">
        <span className="ballot-rank">{index + 1}</span>
        <span>Choose your #{index + 1} project</span>
      </li>
    );
  return (
    <Reorder.Item value={project._id} className="ballot-slot">
      <span className="ballot-rank">{index + 1}</span>
      <div className="ballot-slot-content">
        <strong>{project.name}</strong>
        <button
          className="ballot-remove"
          onClick={onRemove}
          aria-label={`Remove ${project.name} from ballot`}
        >
          Remove
        </button>
      </div>
      <div className="ballot-move">
        <button
          onClick={() => onMove?.(-1)}
          disabled={index === 0}
          aria-label={`Move ${project.name} up`}
        >
          <DirectionIcon direction="up" />
        </button>
        <button
          onClick={() => onMove?.(1)}
          disabled={last}
          aria-label={`Move ${project.name} down`}
        >
          <DirectionIcon direction="down" />
        </button>
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
      <div className="fi-radius-module border border-amber-500/25 bg-[linear-gradient(140deg,rgba(245,158,11,0.16),rgba(251,191,36,0.05),transparent_65%)] p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 fi-surface/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 ">
              <TrophyIcon className="h-4 w-4" />
              Results Released
            </div>
            <div>
              <h2 className="text-3xl fi-zone font-bold fi-ink">
                {winner?.name || "Winner"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm fi-muted">
                {winner?.description ||
                  "Final Code & Tell winner selected from ranked ballots."}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="fi-radius-panel border border-border fi-surface/80 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.16em] fi-muted">
                Ballots
              </div>
              <div className="mt-1 text-2xl font-bold fi-ink">
                {results.totalBallots}
              </div>
            </div>
            <div className="fi-radius-panel border border-border fi-surface/80 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.16em] fi-muted">
                Published
              </div>
              <div className="mt-1 text-sm font-semibold fi-ink">
                Ranked summary
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fi-radius-module border border-border fi-surface shadow-sm">
        <div className="border-b border-border px-6 py-5">
          <h3 className="text-xl fi-zone font-bold fi-ink">Top Standings</h3>
          <p className="mt-1 text-sm fi-muted">
            Totals use K-Borda points per ballot (K for 1st, then K−1… down to
            1). Ties use more 1st-place finishes, then 2nd, and so on, then
            name.
          </p>
        </div>
        {results.standings.length === 0 ? (
          <div className="px-6 py-8 text-sm fi-muted">
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
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center fi-radius-panel border border-border bg-muted/30 text-sm font-bold fi-ink">
                    #{index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-base font-semibold fi-ink">
                        {row.name}
                      </div>
                      {index < 3 && (
                        <MedalIcon className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                    <div className="mt-1 line-clamp-2 text-sm fi-muted">
                      {row.description || "No description"}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm md:min-w-[18rem]">
                  <div className="rounded-xl border border-border fi-surface px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.16em] fi-muted">
                      Points
                    </div>
                    <div className="mt-1 font-semibold fi-ink">
                      {row.points}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border fi-surface px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.16em] fi-muted">
                      Ballots
                    </div>
                    <div className="mt-1 font-semibold fi-ink">
                      {row.ballotsCount}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border fi-surface px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.16em] fi-muted">
                      1st Place
                    </div>
                    <div className="mt-1 font-semibold fi-ink">
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

type BallotProps = {
  eventId: Id<"events">;
  event: CodeAndTellEvent;
  onBack: () => void;
};
export type VotingContext = FunctionReturnType<
  typeof api.codeAndTell.getVotingContext
>;
export function CodeAndTellVoteView(props: BallotProps) {
  const { eventId, event } = props;
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const publicResults = useQuery(
    api.codeAndTell.getPublicResults,
    event.resultsReleased ? { eventId } : "skip",
  );
  const saveBallot = useMutation(api.codeAndTell.saveBallot);
  const votingContext = useQuery(
    api.codeAndTell.getVotingContext,
    event.status === "active" && loggedInUser?.email?.trim()
      ? { eventId }
      : "skip",
  );
  return (
    <ParticipationFrame mode="code_and_tell">
      <CodeAndTellBallotView
        key={props.eventId}
        {...props}
        loggedInUser={loggedInUser}
        publicResults={publicResults}
        votingContext={votingContext}
        saveBallot={saveBallot}
      />
    </ParticipationFrame>
  );
}

export function CodeAndTellBallotView({
  eventId,
  event,
  onBack,
  loggedInUser,
  publicResults,
  votingContext,
  saveBallot,
}: BallotProps & {
  loggedInUser: { _id: string; email?: string } | null | undefined;
  publicResults: PublicResults | null | undefined;
  votingContext: VotingContext | undefined;
  saveBallot: (args: {
    eventId: Id<"events">;
    rankedTeamIds: Id<"teams">[];
  }) => Promise<unknown>;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [rankedTeamIds, setRankedTeamIds] = useState<Id<"teams">[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const hasVerifiedEmail = Boolean(loggedInUser?.email?.trim());
  const ballotSignature = useMemo(
    () => (votingContext?.currentBallotTeamIds || []).join(":"),
    [votingContext?.currentBallotTeamIds],
  );

  const prevSignatureRef = useRef<string | null>(null);
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (votingContext) {
      const currentUserId = loggedInUser ? String(loggedInUser._id) : null;
      if (
        prevUserIdRef.current !== currentUserId ||
        prevSignatureRef.current !== ballotSignature
      ) {
        setRankedTeamIds(votingContext.currentBallotTeamIds || []);
        prevUserIdRef.current = currentUserId;
        prevSignatureRef.current = ballotSignature;
      }
    }
  }, [votingContext, ballotSignature, loggedInUser?._id]);

  const projectById = useMemo(() => {
    return new Map(
      (votingContext?.projects || []).map((project) => [
        String(project._id),
        project,
      ]),
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
    [rankedTeamIds],
  );
  const hasUnsavedChanges = currentSignature !== ballotSignature;
  const isSaved =
    ballotComplete &&
    !hasUnsavedChanges &&
    votingContext?.currentBallotTeamIds?.length === requiredRankCount;

  const addProjectToBallot = (teamId: Id<"teams">) => {
    setRankedTeamIds((current) => {
      if (current.includes(teamId) || current.length >= requiredRankCount) {
        return current;
      }
      return [...current, teamId];
    });
  };

  const renderBallot = () => (
    <aside
      className="ballot-board"
      id="your-ballot"
      aria-labelledby="ballot-heading"
    >
      <div className="ballot-board-heading">
        <h2 id="ballot-heading">Your ballot</h2>
        <span>
          {rankedTeamIds.length} / {requiredRankCount}
        </span>
      </div>
      <p>
        Rank your top {requiredRankCount} projects. Your favorite goes first.
      </p>
      <Reorder.Group
        axis="y"
        values={rankedTeamIds}
        onReorder={setRankedTeamIds}
        className="ballot-slots"
      >
        {rankedTeamIds.map((teamId, index) => (
          <BallotSlot
            key={teamId}
            index={index}
            project={projectById.get(String(teamId))}
            onRemove={() => removeProjectFromBallot(teamId)}
            onMove={(direction) => moveBallotProject(index, direction)}
            last={index === rankedTeamIds.length - 1}
          />
        ))}
      </Reorder.Group>
      <ol className="ballot-slots" start={rankedTeamIds.length + 1}>
        {Array.from({ length: remainingSlots }, (_, i) => (
          <BallotSlot
            key={i}
            index={rankedTeamIds.length + i}
            onRemove={() => {}}
          />
        ))}
      </ol>
      <p className="ballot-help">
        Drag to reorder, or use the up and down buttons.
      </p>
      <div className="ballot-state" role="status">
        {isSaved
          ? "Your ballot is safely stored."
          : ballotComplete
            ? "Ready to submit. Check your order before saving."
            : `${remainingSlots} slot${remainingSlots === 1 ? "" : "s"} still open.`}
      </div>
      <button
        className="participation-primary ballot-submit"
        onClick={() => void handleSaveBallot()}
        disabled={
          !ballotComplete ||
          isSubmitting ||
          votingClosedToNewVoters ||
          !hasUnsavedChanges
        }
      >
        {isSubmitting
          ? "Saving ballot..."
          : isSaved
            ? "Ballot submitted"
            : "Save Ballot"}
        <DirectionIcon />
      </button>
      <p className="ballot-saved-note">
        {lastSavedAt
          ? `Last saved at ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
          : votingContext?.currentBallotTeamIds?.length
            ? "Existing ballot loaded. You can replace it until the event ends."
            : "Your picks are not submitted until you save."}
      </p>
    </aside>
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
      <div className="ct-fi-page max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 fi-key"
        >
          <svg
            className="h-5 w-5"
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
          Back to Events
        </button>

        <div className="mb-8 fi-radius-module border border-border fi-surface px-6 py-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 ">
                Code &amp; Tell
              </div>
              <h1 className="mt-3 text-3xl fi-zone font-bold fi-ink">
                {event.name}
              </h1>
              <p className="mt-2 max-w-3xl text-sm fi-muted">
                {event.description}
              </p>
            </div>
            <div className="text-sm fi-muted">
              {formatDateTime(event.startDate).split(",")[0]}
            </div>
          </div>
        </div>

        {publicResults ? (
          <ResultsSection event={event} results={publicResults} />
        ) : (
          <div className="fi-radius-module border border-border fi-surface px-6 py-8 text-sm fi-muted">
            Results have not been published yet.
          </div>
        )}
      </div>
    );
  }

  if (event.status === "upcoming") {
    return (
      <div className="ct-fi-page max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 fi-key"
        >
          <svg
            className="h-5 w-5"
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
          Back to Events
        </button>
        <div className="fi-radius-module border border-border fi-surface p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center fi-radius-panel bg-amber-500/10 text-amber-600 ">
            <TrophyIcon className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-3xl fi-zone font-bold fi-ink">
            {event.name}
          </h1>
          <p className="mt-3 text-sm fi-muted">
            Voting opens when the event becomes active. Projects are already
            managed by admins, and ranked ballots will unlock at the scheduled
            start time.
          </p>
        </div>
      </div>
    );
  }

  if (event.status === "past") {
    return (
      <div className="ct-fi-page max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 fi-key"
        >
          <svg
            className="h-5 w-5"
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
          Back to Events
        </button>
        <div className="fi-radius-module border border-border fi-surface p-8 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] fi-muted">
            Code &amp; Tell
          </div>
          <h1 className="mt-4 text-3xl fi-zone font-bold fi-ink">
            Results Pending
          </h1>
          <p className="mt-3 text-sm fi-muted">
            Balloting is closed. Admins still need to confirm the final winner
            and release the ranked-vote results.
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
      <div className="ct-fi-page max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 fi-key"
        >
          <svg
            className="h-5 w-5"
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
          Back to Events
        </button>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_24rem]">
          <div className="fi-radius-module border border-amber-500/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),transparent_72%)] p-8 shadow-sm">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 fi-surface/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 ">
              Code &amp; Tell Ballot
            </div>
            <h1 className="mt-4 text-3xl fi-zone font-bold fi-ink">
              Sign in to vote
            </h1>
            <p className="mt-3 text-sm fi-muted">
              Code &amp; Tell uses one editable ranked ballot per signed-in
              voter. Your own projects stay visible, but they cannot be placed
              in your ranking.
            </p>
          </div>
          <div className="fi-radius-module border border-border fi-surface p-6 shadow-sm">
            <h2 className="text-xl fi-zone font-bold fi-ink">Sign In</h2>
            <p className="mt-2 text-sm fi-muted">
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
          className="mb-6 flex items-center gap-2 fi-key"
        >
          <svg
            className="h-5 w-5"
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
          Back to Events
        </button>
        <div className="fi-radius-module border border-red-500/20 bg-red-500/5 p-8 text-sm text-red-700  shadow-sm">
          A verified account email is required to vote in Code &amp; Tell
          events.
        </div>
      </div>
    );
  }

  if (votingContext == null) {
    return <LoadingState label="Loading ballot..." />;
  }

  return (
    <div className="participation-content ballot-page">
      <ParticipationHeader
        title={event.name}
        description="Explore the projects. Pick your favorites. Put them in order."
        onBack={onBack}
        aside={
          <span className="participation-status">
            Voting open · {formatDateTime(event.startDate).split(",")[0]}
          </span>
        }
      />
      {votingClosedToNewVoters && (
        <p className="participation-notice" role="status">
          This event has reached its voting limit for new voters. Existing
          voters can still update their ballot. Contact an organizer if you need
          help.
        </p>
      )}
      {isSaved && (
        <p className="participation-notice" role="status">
          Your ballot is submitted. You can still make changes until the event
          ends.
        </p>
      )}
      <div className="ballot-layout">
        <section aria-labelledby="ballot-projects-heading">
          <div className="participation-section-title">
            <h2 id="ballot-projects-heading">Find your favorites</h2>
            <span>{filteredProjects.length} projects</span>
          </div>
          <label className="participation-search">
            <span>Search projects</span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Project, description, or member"
            />
          </label>
          {votingContext.eligibleProjectCount === 0 ? (
            <p className="participation-empty">
              You do not have any eligible projects to rank in this event.
            </p>
          ) : filteredProjects.length === 0 ? (
            <p className="participation-empty">
              No projects match that search.
            </p>
          ) : (
            <div className="ballot-projects">
              {filteredProjects.map((project) => {
                const rank = rankedTeamIds.indexOf(project._id);
                return (
                  <article
                    key={project._id}
                    className={`ballot-project${rank >= 0 ? " is-picked" : ""}`}
                  >
                    <div className="ballot-project-heading">
                      <h3>{project.name}</h3>
                      {rank >= 0 && (
                        <span className="participation-badge">
                          Ranked #{rank + 1}
                        </span>
                      )}
                      {project.isOwned && (
                        <span className="participation-badge">
                          Your project
                        </span>
                      )}
                    </div>
                    <p>{project.description || "No description"}</p>
                    {project.members.length > 0 && (
                      <p className="ballot-members">
                        {project.members.join(" · ")}
                      </p>
                    )}
                    <div className="ballot-project-actions">
                      {project.projectUrl && (
                        <a
                          href={project.projectUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View project <DirectionIcon />
                        </a>
                      )}
                      {project.isOwned || !project.isEligible ? (
                        <span className="participation-badge">Ineligible</span>
                      ) : rank >= 0 ? (
                        <button
                          className="participation-secondary"
                          onClick={() => removeProjectFromBallot(project._id)}
                        >
                          Remove from ballot
                        </button>
                      ) : (
                        <button
                          className="participation-secondary"
                          onClick={() => addProjectToBallot(project._id)}
                          disabled={
                            votingClosedToNewVoters ||
                            rankedTeamIds.length >= requiredRankCount
                          }
                        >
                          Add to ballot
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        {renderBallot()}
      </div>
      <a className="ballot-mobile-jump" href="#your-ballot">
        Your ballot{" "}
        <span>
          {rankedTeamIds.length} / {requiredRankCount}
        </span>
        <DirectionIcon direction="down" />
      </a>
    </div>
  );
}
