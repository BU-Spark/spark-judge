import "./CodeAndTellVoteView.fi.css";
import { CodeAndTellWorkspace } from "./CodeAndTellWorkspace";
import { ProjectListViewport } from "./ProjectListViewport";
import {
  codeAndTellPhase,
  type CodeAndTellPhase,
} from "../../../convex/codeAndTellPhase";
import { useMutation, useQuery } from "convex/react";
import { useDeferredValue, useEffect, useMemo, useState, useRef } from "react";
import type { FunctionReturnType } from "convex/server";
import {
  ParticipationFrame,
  DirectionIcon,
} from "../participation/ParticipationChrome";
import { Reorder } from "framer-motion";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { LoadingState } from "../ui/LoadingState";
import { ProjectDescription } from "../ui/ProjectDescription";

export type CodeAndTellEvent = {
  codeAndTellPhase?: CodeAndTellPhase;
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

function ScoreBreakdown({
  standing,
  totalBallots,
}: {
  standing: PublicResults["standings"][number];
  totalBallots: number;
}) {
  return (
    <div className="ct-score-breakdown">
      <dl className="ct-winner-totals">
        <div>
          <dt>Total points</dt>
          <dd>{standing.points}</dd>
        </div>
        <div>
          <dt>Ballots received</dt>
          <dd>
            {standing.ballotsCount}
            <span> / {totalBallots}</span>
          </dd>
        </div>
      </dl>
      <h4>How the audience ranked it</h4>
      <ol className="ct-rank-breakdown">
        {standing.rankCounts.map((count, index) => (
          <li key={index}>
            <span>#{index + 1} choice</span>
            <span className="ct-rank-track" aria-hidden="true">
              <span
                style={{
                  width: `${totalBallots ? (count / totalBallots) * 100 : 0}%`,
                }}
              />
            </span>
            <span>
              {count} {count === 1 ? "ballot" : "ballots"}
            </span>
          </li>
        ))}
      </ol>
      <p className="ct-score-explainer">
        Higher-ranked choices earn more points. The organizers confirm the final
        winner.
      </p>
    </div>
  );
}

function ResultsSection({
  event,
  results,
}: {
  event: CodeAndTellEvent;
  results: PublicResults;
}) {
  const winnerStanding = results.standings.find(
    (row) => row.teamId === results.winnerTeamId,
  );
  const winner =
    winnerStanding ??
    event.teams.find((team) => team._id === results.winnerTeamId);
  const runnersUp = results.standings
    .filter((row) => row.teamId !== results.winnerTeamId)
    .slice(0, 2);
  return (
    <section className="ct-results">
      <div className="ct-winner">
        <h2>{winner ? "Your Code & Tell winner." : "Results"}</h2>
        {winner ? (
          <>
            <h3>{winner.name}</h3>
            <ProjectDescription description={winner.description} projectName={winner.name} />
            {winnerStanding && (
              <details className="ct-score-details ct-winner-details">
                <summary>
                  <span>Scoring breakdown</span>
                  <span>{winnerStanding.points} points</span>
                  <DirectionIcon direction="down" />
                </summary>
                <ScoreBreakdown
                  standing={winnerStanding}
                  totalBallots={results.totalBallots}
                />
              </details>
            )}
            {winner.projectUrl && (
              <a href={winner.projectUrl} target="_blank" rel="noreferrer">
                Explore the project <DirectionIcon />
              </a>
            )}
            {runnersUp.length > 0 && (
              <ol
                className="ct-runners-up"
                aria-label="Second and third place"
                start={2}
              >
                {runnersUp.map((project, index) => (
                  <li key={project.teamId}>
                    <details className="ct-score-details ct-runner-details">
                      <summary>
                        <span className="ct-place">
                          {index === 0 ? "2nd place" : "3rd place"}
                        </span>
                        <strong>{project.name}</strong>
                        <span className="ct-runner-points">
                          {project.points} points
                        </span>
                        <DirectionIcon direction="down" />
                      </summary>
                      <ScoreBreakdown
                        standing={project}
                        totalBallots={results.totalBallots}
                      />
                    </details>
                  </li>
                ))}
              </ol>
            )}
          </>
        ) : (
          <p>No winner has been published.</p>
        )}
      </div>
      <div className="ct-standings">
        <h2>The audience’s favorites</h2>
        <p>{results.totalBallots} ballots submitted</p>
        {results.standings.length ? (
          <ol
            className="ct-results-scroll"
            role="region"
            aria-label="Ranked project results"
            tabIndex={0}
          >
            {results.standings.map((row) => (
              <li key={row.teamId}>
                <div>
                  <h3>{row.name}</h3>
                  <ProjectDescription description={row.description} projectName={row.name} />
                </div>
                <span>{row.points} points</span>
              </li>
            ))}
          </ol>
        ) : (
          <p>No ranked results to show.</p>
        )}
      </div>
    </section>
  );
}

type BallotProps = {
  contextLabel?: string;
  eventId: Id<"events">;
  event: CodeAndTellEvent;
  onBack: () => void;
  onSignIn?: () => void;
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
  const savedBallot = useQuery(
    api.codeAndTell.getMyBallot,
    loggedInUser && codeAndTellPhase(event) === "closed" ? { eventId } : "skip",
  );
  const votingContext = useQuery(
    api.codeAndTell.getVotingContext,
    codeAndTellPhase(event) === "voting" && loggedInUser?.email?.trim()
      ? { eventId }
      : "skip",
  );
  return (
    <ParticipationFrame mode="code_and_tell">
      <CodeAndTellWorkspace
        key={`${eventId}:${loggedInUser?._id ?? "signed-out"}`}
        event={event}
        onBack={props.onBack}
        contextLabel={props.contextLabel}
      >
        <CodeAndTellBallotView
          key={props.eventId}
          {...props}
          loggedInUser={loggedInUser}
          publicResults={publicResults}
          submittedBallot={savedBallot}
          votingContext={votingContext}
          saveBallot={saveBallot}
        />
      </CodeAndTellWorkspace>
    </ParticipationFrame>
  );
}

export function CodeAndTellBallotView({
  eventId,
  event,
  onBack,
  loggedInUser,
  publicResults,
  submittedBallot,
  votingContext: suppliedVotingContext,
  saveBallot,
  onPreviewSignIn,
  onSignIn,
}: BallotProps & {
  onPreviewSignIn?: () => void;
  submittedBallot?: Id<"teams">[];
  loggedInUser: { _id: string; email?: string } | null | undefined;
  publicResults: PublicResults | null | undefined;
  votingContext: VotingContext | undefined;
  saveBallot: (args: {
    eventId: Id<"events">;
    rankedTeamIds: Id<"teams">[];
  }) => Promise<unknown>;
}) {
  const phase = codeAndTellPhase(event);
  const [mobileBallot, setMobileBallot] = useState(
    () => window.matchMedia("(max-width: 850px)").matches,
  );
  const [ballotOpen, setBallotOpen] = useState(false);
  const ballotDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 850px)");
    const update = () => {
      setMobileBallot(media.matches);
      if (!media.matches) setBallotOpen(false);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const dialog = ballotDialog.current;
    if (mobileBallot && loggedInUser && ballotOpen) dialog?.showModal();
    else dialog?.close();
  }, [mobileBallot, loggedInUser, ballotOpen]);
  const votingNotOpen = phase === "presentations" || phase === "submissions";
  const votingContext = useMemo<VotingContext | undefined>(() => {
    if (!votingNotOpen && loggedInUser) return suppliedVotingContext;
    const projects =
      (loggedInUser ? suppliedVotingContext?.projects : undefined) ??
      event.teams.map((team) => ({
        ...team,
        members: team.members ?? [],
        projectUrl: team.projectUrl ?? team.githubUrl,
        isOwned: false,
        isEligible: true,
      }));
    const eligibleProjectCount = projects.filter(
      (project) => project.isEligible,
    ).length;
    return {
      myEmail: "",
      ownProjectIds: suppliedVotingContext?.ownProjectIds ?? [],
      requiredRankCount: Math.min(5, eligibleProjectCount),
      eligibleProjectCount,
      currentBallotTeamIds: [],
      maxBallots: null,
      rankedVoteRowCount: 0,
      hasSubmittedBallot: false,
      votingClosedToNewVoters: false,
      projects,
    };
  }, [votingNotOpen, suppliedVotingContext, event.teams, loggedInUser]);
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
    if (projects.length < 10 || !query) return projects;
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
    if (votingNotOpen || !loggedInUser) return;
    setRankedTeamIds((current) => {
      if (current.includes(teamId) || current.length >= requiredRankCount) {
        return current;
      }
      return [...current, teamId];
    });
  };

  const requestSignIn = () => {
    if (onPreviewSignIn) onPreviewSignIn();
    else if (onSignIn) onSignIn();
    else window.dispatchEvent(new CustomEvent("hackjudge:open-signin"));
  };

  const renderBallot = () => !loggedInUser ? (
    <aside
      className="ballot-board ballot-board--signed-out"
      id="your-ballot"
      aria-labelledby="ballot-heading"
    >
      <div className="ballot-board-heading">
        <h2 id="ballot-heading">Your ballot</h2>
      </div>
      <p>Sign in to choose and rank your favorite projects.</p>
      <button
        className="participation-primary ballot-submit"
        onClick={requestSignIn}
        disabled={loggedInUser === undefined}
      >
        Sign in to vote <DirectionIcon />
      </button>
      {votingNotOpen && (
        <p className="ballot-saved-note">Voting hasn’t opened yet. Enjoy the presentations in the meantime.</p>
      )}
    </aside>
  ) : (
    <aside
      className={`ballot-board${votingNotOpen ? " ballot-board--disabled" : ""}`}
      aria-disabled={votingNotOpen || undefined}
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
        {votingNotOpen
          ? "Voting hasn’t opened yet. You’ll be able to rank your favorites here once the organizers open voting."
          : `Rank your top ${requiredRankCount} projects. Your favorite goes first.`}
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
      {!votingNotOpen && (
        <p className="ballot-help">
          Drag to reorder, or use the up and down buttons.
        </p>
      )}
      <div className="ballot-state" role="status">
        {votingNotOpen
          ? "Waiting for voting to open"
          : isSaved
            ? "Your ballot is safely stored."
            : ballotComplete
              ? "Ready to submit. Check your order before saving."
              : `${remainingSlots} slot${remainingSlots === 1 ? "" : "s"} still open.`}
      </div>
      <button
        className="participation-primary ballot-submit"
        onClick={() => void handleSaveBallot()}
        disabled={
          votingNotOpen ||
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
        {votingNotOpen
          ? "Enjoy the presentations in the meantime."
          : lastSavedAt
            ? `Last saved at ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
            : votingContext?.currentBallotTeamIds?.length
              ? "Existing ballot loaded. You can replace it until voting closes."
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
    if (votingNotOpen || !loggedInUser) return;
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
      <div className="ct-fi-page">
        {publicResults ? (
          <ResultsSection event={event} results={publicResults} />
        ) : (
          <p>Results have not been published yet.</p>
        )}
      </div>
    );
  }

  if (phase === "closed") {
    return (
      <div className={`ct-closed${loggedInUser ? " ballot-layout" : ""}`}>
        <section className="ct-stage-message">
          <h2>That’s a wrap.</h2>
          <p>
            Voting is closed. Results will appear here once the organizers
            confirm the winner.
          </p>
        </section>
        {loggedInUser && (
          <aside
            className="ballot-board ballot-receipt"
            aria-labelledby="submitted-ballot-heading"
          >
            <div className="ballot-board-heading">
              <h2 id="submitted-ballot-heading">Your submitted ballot</h2>
            </div>
            {submittedBallot === undefined ? (
              <LoadingState label="Loading your submitted ballot..." />
            ) : submittedBallot.length ? (
              <>
                <p>
                  Your ranking is saved. Voting is closed, so this ballot can’t
                  be changed.
                </p>
                <ol className="ballot-slots">
                  {submittedBallot.map((teamId, index) => {
                    const project = event.teams.find(
                      (team) => team._id === teamId,
                    );
                    return (
                      <li className="ballot-slot" key={teamId}>
                        <span className="ballot-rank">{index + 1}</span>
                        <div className="ballot-slot-content">
                          <strong>
                            {project?.name ?? "Project no longer available"}
                          </strong>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <p className="ballot-saved-note">Ballot submitted</p>
              </>
            ) : (
              <p>You didn’t submit a ballot for this event.</p>
            )}
          </aside>
        )}
      </div>
    );
  }

  if (!votingNotOpen && loggedInUser === undefined) {
    return <LoadingState label="Loading voting access..." />;
  }

  if (!votingNotOpen && loggedInUser && !hasVerifiedEmail) {
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
      {votingClosedToNewVoters && (
        <p className="participation-notice" role="status">
          This event has reached its voting limit for new voters. Existing
          voters can still update their ballot. Contact an organizer if you need
          help.
        </p>
      )}
      {isSaved && (
        <p className="participation-notice" role="status">
          Your ballot is submitted. You can still make changes until voting
          closes.
        </p>
      )}
      <div className="ballot-layout">
        <section aria-label="Projects">
          {votingContext.projects.length >= 10 && <label className="participation-search">
            <span>Search projects</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Project, description, or member"
            />
          </label>}
          {votingContext.eligibleProjectCount === 0 ? (
            <p className="participation-empty">
              You do not have any eligible projects to rank in this event.
            </p>
          ) : filteredProjects.length === 0 ? (
            <p className="participation-empty">
              No projects match that search.
            </p>
          ) : (
            <ProjectListViewport>
              {filteredProjects.map((project) => {
                const rank = rankedTeamIds.indexOf(project._id);
                return (
                  <article
                    key={project._id}
                    className={`ballot-project${rank >= 0 ? " is-picked" : ""}`}
                  >
                    <div className="ballot-project-heading">
                      <h3>{project.name}</h3>
                    </div>
                    <ProjectDescription description={project.description} projectName={project.name} />
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
                      {rank >= 0 && (
                        <span className="ballot-project-rank">
                          Ranked #{rank + 1}
                        </span>
                      )}
                      {project.isOwned || !project.isEligible ? (
                        <span className="participation-badge ballot-project-eligibility">
                          {project.isOwned
                            ? <><span>Your project</span><span className="ballot-eligibility-separator" aria-hidden="true"> · </span><span>Ineligible</span></>
                            : "Ineligible"}
                        </span>
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
                            !loggedInUser ||
                            votingNotOpen ||
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
            </ProjectListViewport>
          )}
        </section>
        {!mobileBallot && (!loggedInUser || votingNotOpen || requiredRankCount > 0) && renderBallot()}
      </div>
      {mobileBallot && loggedInUser && (
        <dialog
          ref={ballotDialog}
          className="ballot-mobile-dialog"
          aria-labelledby="ballot-heading"
          onClose={() => setBallotOpen(false)}
          onClick={(event) => {
            if (event.target === ballotDialog.current) setBallotOpen(false);
          }}
        >
          <div className="ballot-mobile-dialog-content">
            <button
              type="button"
              className="ballot-mobile-close"
              onClick={() => setBallotOpen(false)}
            >
              Close ballot
            </button>
            {renderBallot()}
          </div>
        </dialog>
      )}
      {mobileBallot && phase === "voting" && requiredRankCount > 0 && (loggedInUser ? (
        <button
          type="button"
          className="ballot-mobile-jump"
          aria-haspopup="dialog"
          aria-expanded={ballotOpen}
          onClick={() => setBallotOpen(true)}
        >
          Your ballot{" "}
          <span>
            {rankedTeamIds.length} / {requiredRankCount}
          </span>
        </button>
      ) : (
        <button
          type="button"
          className="ballot-mobile-jump ballot-mobile-sign-in"
          onClick={requestSignIn}
        >
          Sign in to vote
        </button>
      ))}
    </div>
  );
}
