import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ScoringWizard } from "./ScoringWizard";
import { LoadingState } from "./ui/LoadingState";
import { ErrorState } from "./ui/ErrorState";
import { CodeAndTellVoteView } from "./code-and-tell/CodeAndTellVoteView";
import { DemoDayBrowse } from "./demo-day";
import { JudgeCodeModal } from "./JudgeCodeModalNew";
import { getEventDisplayLabel, getEventMode } from "../lib/eventModes";
import { formatDateTime } from "../lib/utils";
import { MODE_THEME } from "./home/modeTheme";
import { toast } from "sonner";
import "./EventView.fi.css";
import "./participation/participation.css";

function pad2(n: number): string {
  return String(Math.max(0, n)).padStart(2, "0");
}

function requestSignIn() {
  window.dispatchEvent(new CustomEvent("hackjudge:open-signin"));
}

function IdleSteps({ count = 8 }: { count?: number }) {
  return (
    <div className="fi-ev-idle-steps" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="fi-ev-idle-step" />
      ))}
    </div>
  );
}

export function EventView({
  eventId,
  onBack,
}: {
  eventId: Id<"events">;
  onBack: () => void;
}) {
  const event = useQuery(api.events.getEvent, { eventId });
  const judgeStatus = useQuery(api.events.getJudgeStatus, { eventId });
  const myScores = useQuery(api.scores.getMyScores, { eventId });
  const myAssignments = useQuery(api.judgeAssignments.getMyAssignments, {
    eventId,
  });
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const addTeamToAssignment = useMutation(
    api.judgeAssignments.addTeamToAssignment,
  );
  const addMultipleTeamsToAssignment = useMutation(
    api.judgeAssignments.addMultipleTeamsToAssignment,
  );
  const removeTeamFromAssignment = useMutation(
    api.judgeAssignments.removeTeamFromAssignment,
  );
  const joinAsJudge = useMutation(api.events.joinAsJudge);
  const [showWizard, setShowWizard] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftCompletedCount, setDraftCompletedCount] = useState(0);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [trackFilter, setTrackFilter] = useState("");
  const [sponsorFilter, setSponsorFilter] = useState("");
  const [prizeFilter, setPrizeFilter] = useState("");
  const [myQueueOnly, setMyQueueOnly] = useState(false);
  const [hoveredTeam, setHoveredTeam] = useState<{
    name: string;
    line: string;
  } | null>(null);
  const [judgeCodeOpen, setJudgeCodeOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const eventPrizes = useQuery(api.prizes.listEventPrizes, { eventId }) || [];
  const eventPrizeSubmissions =
    useQuery(api.prizes.getEventPrizeSubmissions, { eventId }) || [];

  const storageKey = judgeStatus
    ? `scoring_draft_${eventId}_${judgeStatus.userId}`
    : null;

  useEffect(() => {
    if (!storageKey) {
      setHasDraft(false);
      setDraftCompletedCount(0);
      return;
    }
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        setHasDraft(true);
        const parsed = JSON.parse(raw);
        if (parsed.completed && Array.isArray(parsed.completed)) {
          setDraftCompletedCount(parsed.completed.length);
        } else {
          setDraftCompletedCount(0);
        }
      } else {
        setHasDraft(false);
        setDraftCompletedCount(0);
      }
    } catch {
      setHasDraft(false);
      setDraftCompletedCount(0);
    }
  }, [storageKey, showWizard, myScores?.length]);

  const enableCohorts = event?.enableCohorts || false;
  const scoringLocked = !!event?.scoringLockedAt;

  const visibleTeams = useMemo(
    () => (event?.teams ?? []).filter((team: any) => !team.hidden),
    [event?.teams],
  );

  const teamsToJudge = useMemo(() => {
    if (!enableCohorts || !myAssignments) return visibleTeams;
    return visibleTeams.filter((team: any) => myAssignments.includes(team._id));
  }, [enableCohorts, visibleTeams, myAssignments]);

  const relevantTeamIds = useMemo(
    () => new Set(teamsToJudge.map((team: any) => String(team._id))),
    [teamsToJudge],
  );

  const totalTeams = teamsToJudge.length;
  const completedCount = hasDraft
    ? draftCompletedCount
    : (myScores?.filter((score: any) =>
        relevantTeamIds.has(String(score.teamId)),
      ).length ?? 0);

  const scoringComplete = totalTeams > 0 && completedCount >= totalTeams;

  const trackOptions = useMemo(
    () =>
      Array.from(
        new Set(visibleTeams.map((t: any) => t.track).filter(Boolean)),
      ).sort(),
    [visibleTeams],
  );

  const sponsorOptions = useMemo(
    () =>
      Array.from(
        new Set(eventPrizes.map((p: any) => p.sponsorName).filter(Boolean)),
      ).sort(),
    [eventPrizes],
  );

  const filteredTeams = useMemo(() => {
    let baseTeams = visibleTeams;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      baseTeams = baseTeams.filter(
        (team: any) =>
          team.name.toLowerCase().includes(q) ||
          team.description.toLowerCase().includes(q),
      );
    }

    if (trackFilter) {
      baseTeams = baseTeams.filter((team: any) => team.track === trackFilter);
    }

    if (sponsorFilter) {
      const matchingPrizeIds = new Set(
        eventPrizes
          .filter((p: any) => p.sponsorName === sponsorFilter)
          .map((p: any) => p._id),
      );
      const teamIdsWithSponsor = new Set(
        eventPrizeSubmissions
          .filter((s: any) => matchingPrizeIds.has(s.prizeId))
          .map((s: any) => s.teamId),
      );
      baseTeams = baseTeams.filter((team: any) =>
        teamIdsWithSponsor.has(team._id),
      );
    }

    if (prizeFilter) {
      const teamIdsWithPrize = new Set(
        eventPrizeSubmissions
          .filter((s: any) => s.prizeId === prizeFilter)
          .map((s: any) => s.teamId),
      );
      baseTeams = baseTeams.filter((team: any) =>
        teamIdsWithPrize.has(team._id),
      );
    }

    return baseTeams.filter((team: any) => !myAssignments?.includes(team._id));
  }, [
    visibleTeams,
    searchQuery,
    trackFilter,
    sponsorFilter,
    prizeFilter,
    myAssignments,
    eventPrizes,
    eventPrizeSubmissions,
  ]);

  const assignedTeams = useMemo(() => {
    return visibleTeams.filter((team: any) =>
      myAssignments?.includes(team._id),
    );
  }, [visibleTeams, myAssignments]);

  const keyboardTeams = useMemo(() => {
    if (enableCohorts) return assignedTeams;
    let base = visibleTeams;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      base = base.filter(
        (team: any) =>
          team.name.toLowerCase().includes(q) ||
          (typeof team.description === "string" &&
            team.description.toLowerCase().includes(q)),
      );
    }
    if (trackFilter) {
      base = base.filter((team: any) => team.track === trackFilter);
    }
    if (sponsorFilter) {
      const matchingPrizeIds = new Set(
        eventPrizes
          .filter((p: any) => p.sponsorName === sponsorFilter)
          .map((p: any) => p._id),
      );
      const teamIdsWithSponsor = new Set(
        eventPrizeSubmissions
          .filter((s: any) => matchingPrizeIds.has(s.prizeId))
          .map((s: any) => s.teamId),
      );
      base = base.filter((team: any) => teamIdsWithSponsor.has(team._id));
    }
    if (prizeFilter) {
      const teamIdsWithPrize = new Set(
        eventPrizeSubmissions
          .filter((s: any) => s.prizeId === prizeFilter)
          .map((s: any) => s.teamId),
      );
      base = base.filter((team: any) => teamIdsWithPrize.has(team._id));
    }
    return base;
  }, [
    enableCohorts,
    assignedTeams,
    visibleTeams,
    searchQuery,
    trackFilter,
    sponsorFilter,
    prizeFilter,
    eventPrizes,
    eventPrizeSubmissions,
  ]);

  const teamParam = searchParams.get("team");
  const initialTeamId = useMemo(() => {
    if (!teamParam) return null;
    const match = teamsToJudge.find(
      (team: any) => String(team._id) === teamParam,
    );
    return match ? (match._id as Id<"teams">) : null;
  }, [teamParam, teamsToJudge]);

  useEffect(() => {
    if (initialTeamId && !scoringLocked) {
      setShowWizard(true);
    }
  }, [initialTeamId, scoringLocked]);

  const clearTeamParam = () => {
    if (!searchParams.has("team")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("team");
    setSearchParams(next, { replace: true });
  };

  const closeWizard = () => {
    setShowWizard(false);
    clearTeamParam();
  };

  const handleToggleTeam = async (teamId: Id<"teams">, isAssigned: boolean) => {
    if (scoringLocked) {
      alert(
        "Scoring has been locked by an admin. Team assignments can no longer be changed.",
      );
      return;
    }

    if (isAssigned) {
      const teamHasBeenScored = myScores?.some((s: any) => s.teamId === teamId);
      if (teamHasBeenScored) {
        toast.error(
          "You cannot remove a team after you have already submitted scores for them.",
        );
        return;
      }
    }

    try {
      if (isAssigned) {
        await removeTeamFromAssignment({ eventId, teamId });
        toast.success("Team removed from queue");
      } else {
        await addTeamToAssignment({ eventId, teamId });
        toast.success("Team added to queue");
      }
    } catch (error) {
      console.error("Failed to toggle team assignment:", error);
      toast.error("Failed to update team assignment");
    }
  };

  const handleAddAllTeams = async () => {
    if (scoringLocked) {
      alert(
        "Scoring has been locked by an admin. Team assignments can no longer be changed.",
      );
      return;
    }
    try {
      const teamIds = filteredTeams.map((t: any) => t._id);
      const addedCount = await addMultipleTeamsToAssignment({
        eventId,
        teamIds,
      });
      if (addedCount > 0) {
        toast.success(
          `Added ${addedCount} team${addedCount === 1 ? "" : "s"} to your queue!`,
        );
      } else {
        toast("All these teams are already in your queue.");
      }
    } catch (error) {
      console.error("Failed to add all teams:", error);
      toast.error("Failed to add teams.");
    }
  };

  const handleWizardSubmitted = () => {
    setShowWizard(false);
    setHasDraft(false);
    setJustSubmitted(true);
    clearTeamParam();
  };

  const handleJoinAsJudge = async () => {
    if (!loggedInUser) {
      requestSignIn();
      return;
    }
    if (joining) return;
    setJoining(true);
    try {
      await joinAsJudge({ eventId });
      toast.success("Successfully joined as judge!");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to join as judge",
      );
    } finally {
      setJoining(false);
    }
  };

  const openJudgeCode = () => {
    if (!loggedInUser) {
      requestSignIn();
      return;
    }
    setJudgeCodeOpen(true);
  };

  if (event === undefined) {
    return <LoadingState label="Loading event details..." />;
  }

  if (event === null) {
    return (
      <ErrorState
        title="Event not found"
        description="This event may have been removed or you no longer have access."
        actionLabel="Back to events"
        onAction={onBack}
      />
    );
  }

  const eventMode = getEventMode(event.mode);

  if (eventMode === "demo_day") {
    return <DemoDayBrowse eventId={eventId} event={event} onBack={onBack} />;
  }

  if (eventMode === "code_and_tell") {
    return (
      <CodeAndTellVoteView eventId={eventId} event={event} onBack={onBack} />
    );
  }

  if (
    judgeStatus === undefined ||
    myScores === undefined ||
    myAssignments === undefined
  ) {
    return (
      <div className="fi-ev-loading" role="status" aria-live="polite">
        <div className="fi-ev-spinner" aria-hidden="true" />
        <span className="fi-sr">Loading judge details...</span>
      </div>
    );
  }

  const theme = MODE_THEME.hackathon;
  const modeStyle = {
    ["--c" as string]: theme.lit,
    ["--c-deep" as string]: theme.deep,
  } as CSSProperties;

  if (!judgeStatus) {
    return (
      <div className="fi-ev-page participation participation--hackathon">
        <button
          type="button"
          onClick={onBack}
          className="fi-key fi-key--sm fi-ev-back"
        >
          Back to events
        </button>
        <div className="fi-panel fi-ev-idle">
          <IdleSteps />
          <p className="fi-engraved fi-ev-idle-copy">
            Not registered · {event.name}
          </p>
          <p className="fi-ev-idle-body">
            You are not registered as a judge for this event.
          </p>
          <div className="fi-ev-idle-actions">
            {!loggedInUser ? (
              <button type="button" className="fi-key" onClick={requestSignIn}>
                Sign in
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="fi-transport"
                  onClick={openJudgeCode}
                >
                  Enter judge code
                </button>
                <button
                  type="button"
                  className="fi-key"
                  onClick={() => void handleJoinAsJudge()}
                  disabled={joining}
                >
                  {joining ? "Joining..." : "Join as judge"}
                </button>
              </>
            )}
            <button
              type="button"
              className="fi-key fi-key--sm"
              onClick={onBack}
            >
              Back to events
            </button>
          </div>
        </div>
        <JudgeCodeModal
          isOpen={judgeCodeOpen}
          onClose={() => setJudgeCodeOpen(false)}
          eventId={eventId}
          onSuccess={() => setJudgeCodeOpen(false)}
        />
      </div>
    );
  }

  const canStart =
    (!enableCohorts || myAssignments.length > 0) &&
    totalTeams > 0 &&
    !scoringLocked;
  const transportLabel = scoringLocked
    ? "Scoring locked"
    : scoringComplete
      ? "Review scores"
      : hasDraft
        ? "Continue scoring"
        : completedCount > 0
          ? "Resume scoring"
          : enableCohorts && myAssignments.length === 0
            ? "Select teams first"
            : "Start scoring";

  const statusLabel = scoringLocked
    ? "Locked"
    : event.status === "active"
      ? "Live"
      : event.status;

  return (
    <div className="fi-ev-page participation participation--hackathon">
      <button
        type="button"
        onClick={onBack}
        className="fi-key fi-key--sm fi-ev-back"
      >
        Back to events
      </button>

      <section className="fi-ev-face" aria-labelledby="fi-ev-event-name">
        <div className="fi-module fi-ev-module" style={modeStyle}>
          <div className="fi-ev-status">
            {event.status === "active" && !scoringLocked ? (
              <span className="fi-ev-live">
                <span className="fi-live-dot" aria-hidden="true" />
                Live
              </span>
            ) : (
              <span className="fi-ev-chip">{statusLabel}</span>
            )}
            <span className="fi-ev-chip fi-ev-chip--mode">
              {getEventDisplayLabel(event.mode)}
            </span>
          </div>

          <h1 className="fi-ev-name" id="fi-ev-event-name">
            {event.name}
          </h1>
          {event.description ? (
            <p className="fi-ev-desc">{event.description}</p>
          ) : null}

          <p className="fi-ev-meta">
            <span>
              Dates{" "}
              <b>
                {formatDateTime(event.startDate)} –{" "}
                {formatDateTime(event.endDate)}
              </b>
            </span>
            <span>
              Your role <b>Judge</b>
            </span>
            <span>
              Status <b>{event.status}</b>
            </span>
          </p>

          {event.status === "active" && (
            <p className="fi-ev-progress">
              <b>{pad2(completedCount)}</b> of {pad2(totalTeams)} scored
              {justSubmitted
                ? " · submitted"
                : hasDraft
                  ? " · draft saved"
                  : ""}
            </p>
          )}

          {event.status === "active" && (
            <div className="fi-ev-actions">
              <button
                type="button"
                className="fi-transport"
                onClick={() => setShowWizard(true)}
                disabled={!canStart}
              >
                {transportLabel}
              </button>
              {scoringComplete && (
                <button type="button" className="fi-ev-ghost" onClick={onBack}>
                  Return to dashboard
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {event.status === "active" && scoringLocked && (
        <div className="fi-panel fi-ev-lock">
          <p className="fi-engraved">Scoring locked</p>
          <p className="fi-ev-lock-copy">
            Scoring is locked for this event. Judges can view scores, but edits
            are disabled until an admin unlocks scoring.
          </p>
        </div>
      )}

      {event.status === "active" && (
        <TeamSelectionSection
          eventId={eventId}
          enableCohorts={enableCohorts}
          teams={filteredTeams}
          assignedTeams={keyboardTeams}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          trackFilter={trackFilter}
          setTrackFilter={setTrackFilter}
          sponsorFilter={sponsorFilter}
          setSponsorFilter={setSponsorFilter}
          prizeFilter={prizeFilter}
          setPrizeFilter={setPrizeFilter}
          myQueueOnly={myQueueOnly}
          setMyQueueOnly={setMyQueueOnly}
          trackOptions={trackOptions as string[]}
          sponsorOptions={sponsorOptions as string[]}
          eventPrizes={eventPrizes}
          onToggleTeam={(teamId, isAssigned) => {
            void handleToggleTeam(teamId, isAssigned);
          }}
          onAddAllTeams={handleAddAllTeams}
          locked={scoringLocked}
          myScores={myScores}
          activeTeamId={initialTeamId}
          onHover={setHoveredTeam}
        />
      )}

      {event.status === "past" && event.resultsReleased && (
        <ResultsView eventId={eventId} />
      )}

      {showWizard && judgeStatus && !scoringLocked && (
        <ScoringWizard
          eventId={eventId}
          eventName={event.name}
          teams={teamsToJudge}
          categories={event.categories.map((c: any) => ({
            name: c.name,
            weight: c.weight,
            optOutAllowed: c.optOutAllowed,
          }))}
          existingScores={myScores ?? []}
          storageKey={storageKey}
          onClose={closeWizard}
          onSubmitted={handleWizardSubmitted}
          initialTeamId={initialTeamId}
        />
      )}
    </div>
  );
}

function ResultsView({ eventId }: { eventId: Id<"events"> }) {
  const event = useQuery(api.events.getEvent, { eventId });
  const eventScores = useQuery(api.scores.getEventScores, { eventId });
  const prizeWinners = useQuery(api.prizes.listPrizeWinners, { eventId });

  if (!event || !eventScores || prizeWinners === undefined) return null;

  const overallWinnerTeam = event.overallWinner
    ? event.teams.find((t: any) => t._id === event.overallWinner)
    : null;
  const hasPrizeWinners = prizeWinners.length > 0;
  const groupedPrizeWinners = hasPrizeWinners
    ? prizeWinners.reduce<Record<string, any[]>>((acc, row: any) => {
        const key = row.prizeId as string;
        if (!acc[key]) acc[key] = [];
        acc[key].push(row);
        return acc;
      }, {})
    : {};

  return (
    <div className="fi-ev-results">
      {hasPrizeWinners ? (
        <section className="fi-ev-zone" aria-labelledby="fi-ev-prizes-h">
          <div className="fi-ev-zone-head">
            <h2 className="fi-zone" id="fi-ev-prizes-h">
              Prize winners
            </h2>
            <span className="fi-engraved">
              Final placements · {pad2(Object.keys(groupedPrizeWinners).length)}{" "}
              prizes
            </span>
          </div>
          <div className="fi-ev-prize-list">
            {Object.values(groupedPrizeWinners).map((winnerRows: any[]) => {
              const first = winnerRows[0];
              const prizeName = first?.prize?.name || "Prize";
              return (
                <div key={first.prizeId} className="fi-ev-prize-row">
                  <h3 className="fi-ev-prize-name">{prizeName}</h3>
                  <div className="fi-ev-prize-teams">
                    {winnerRows
                      .sort(
                        (a: any, b: any) =>
                          (a.placement ?? 999) - (b.placement ?? 999),
                      )
                      .map((row: any) => (
                        <div key={row._id} className="fi-ev-prize-team">
                          <span className="fi-ev-prize-team-name">
                            {row.team?.name || "Unknown Team"}
                          </span>
                          {typeof row.placement === "number" ? (
                            <span className="fi-engraved-sm">
                              Placement {row.placement}
                            </span>
                          ) : row.notes ? (
                            <span className="fi-engraved-sm">{row.notes}</span>
                          ) : null}
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="fi-ev-zone" aria-labelledby="fi-ev-overall-h">
          <div className="fi-ev-zone-head">
            <h2 className="fi-zone" id="fi-ev-overall-h">
              Winners
            </h2>
            <span className="fi-engraved">Released results</span>
          </div>
          <div className="fi-ev-winners">
            <article className="fi-module fi-ev-winner-module">
              <span className="fi-ev-chip">Overall winner</span>
              <p className="fi-ev-winner-name">
                {overallWinnerTeam ? overallWinnerTeam.name : "TBD"}
              </p>
            </article>
            {event.categoryWinners && event.categoryWinners.length > 0 && (
              <div className="fi-ev-ledger">
                {event.categoryWinners.map(
                  (winner: { category: string; teamId: Id<"teams"> }) => {
                    const team = event.teams.find(
                      (t: any) => t._id === winner.teamId,
                    );
                    return (
                      <div key={winner.category} className="fi-ev-ledger-row">
                        <span className="fi-ev-ledger-rank">
                          {winner.category}
                        </span>
                        <span className="fi-ev-ledger-name">
                          {team?.name || "Unknown"}
                        </span>
                        <span className="fi-ev-stamp">Winner</span>
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="fi-ev-zone" aria-labelledby="fi-ev-scores-h">
        <div className="fi-ev-zone-head">
          <h2 className="fi-zone" id="fi-ev-scores-h">
            All scores
          </h2>
          <span className="fi-engraved">
            Event log · {pad2(eventScores.length)} records
          </span>
        </div>
        <div className="fi-ev-ledger">
          {eventScores.map((teamScore: any, index: number) => (
            <div key={teamScore.team._id} className="fi-ev-ledger-row">
              <span className="fi-ev-ledger-rank">#{pad2(index + 1)}</span>
              <span className="fi-ev-ledger-name">{teamScore.team.name}</span>
              <span className="fi-readout">
                {teamScore.averageScore.toFixed(2)}
              </span>
              <span className="fi-ev-stamp">
                {teamScore.judgeCount}{" "}
                {teamScore.judgeCount === 1 ? "judge" : "judges"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TeamSelectionSection({
  eventId,
  enableCohorts,
  teams,
  assignedTeams,
  searchQuery,
  setSearchQuery,
  trackFilter,
  setTrackFilter,
  sponsorFilter,
  setSponsorFilter,
  prizeFilter,
  setPrizeFilter,
  myQueueOnly,
  setMyQueueOnly,
  trackOptions,
  sponsorOptions,
  eventPrizes,
  onToggleTeam,
  onAddAllTeams,
  locked,
  myScores,
  activeTeamId,
  onHover,
}: {
  eventId: Id<"events">;
  enableCohorts: boolean;
  teams: Array<any>;
  assignedTeams: Array<any>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  trackFilter: string;
  setTrackFilter: (f: string) => void;
  sponsorFilter: string;
  setSponsorFilter: (f: string) => void;
  prizeFilter: string;
  setPrizeFilter: (f: string) => void;
  myQueueOnly: boolean;
  setMyQueueOnly: (v: boolean) => void;
  trackOptions: string[];
  sponsorOptions: string[];
  eventPrizes: Array<any>;
  onToggleTeam: (teamId: Id<"teams">, isAssigned: boolean) => void;
  onAddAllTeams: () => void;
  locked: boolean;
  myScores?: Array<any>;
  activeTeamId: Id<"teams"> | null;
  onHover: (team: { name: string; line: string } | null) => void;
}) {
  const getTeamScoreStatus = (teamId: Id<"teams">) => {
    if (!myScores) return null;
    return myScores.find(
      (score: any) => String(score.teamId) === String(teamId),
    );
  };

  const prizeSelectOptions = eventPrizes.filter((p: any) =>
    ["track", "sponsor", "track_sponsor"].includes(p.type),
  );

  const showFilters =
    enableCohorts ||
    assignedTeams.length > 0 ||
    searchQuery ||
    trackFilter ||
    sponsorFilter ||
    prizeFilter;
  const showBrowse =
    enableCohorts &&
    !myQueueOnly &&
    (teams.length > 0 ||
      searchQuery ||
      trackFilter ||
      sponsorFilter ||
      prizeFilter);

  return (
    <div>
      {showFilters && (
        <div className="fi-ev-filters">
          <label className="fi-ev-control fi-ev-control--grow">
            <span className="fi-engraved">Search</span>
            <input
              type="search"
              placeholder="Find a team"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
          <label className="fi-ev-control">
            <span className="fi-engraved">Track</span>
            <select
              value={trackFilter}
              onChange={(e) => setTrackFilter(e.target.value)}
            >
              <option value="">All tracks</option>
              {trackOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="fi-ev-control">
            <span className="fi-engraved">Sponsor</span>
            <select
              value={sponsorFilter}
              onChange={(e) => setSponsorFilter(e.target.value)}
            >
              <option value="">All sponsors</option>
              {sponsorOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          {prizeSelectOptions.length > 0 && (
            <label className="fi-ev-control">
              <span className="fi-engraved">Prize</span>
              <select
                value={prizeFilter}
                onChange={(e) => setPrizeFilter(e.target.value)}
              >
                <option value="">All prizes</option>
                {prizeSelectOptions.map((p: any) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {enableCohorts && (
            <div className="fi-ev-chips">
              <button
                type="button"
                className="fi-ev-toggle"
                aria-pressed={myQueueOnly}
                onClick={() => setMyQueueOnly(!myQueueOnly)}
              >
                My queue
              </button>
            </div>
          )}
        </div>
      )}

      <section className="fi-ev-zone" aria-labelledby="fi-ev-keys-h">
        <div className="fi-ev-zone-head">
          <h2 className="fi-zone" id="fi-ev-keys-h">
            {enableCohorts ? "My queue" : "Projects"}
          </h2>
          <span className="fi-engraved">
            {enableCohorts
              ? `${assignedTeams.length} assigned`
              : `${assignedTeams.length} teams`}
          </span>
        </div>

        {assignedTeams.length === 0 ? (
          enableCohorts ? (
            <div className="fi-panel fi-ev-idle">
              <IdleSteps count={4} />
              <p className="fi-engraved fi-ev-idle-copy">
                {locked
                  ? "Scoring is locked · Team assignments are read-only"
                  : "No teams queued · Browse below to add"}
              </p>
            </div>
          ) : (
            <p className="fi-engraved">No teams match these filters</p>
          )
        ) : (
          <ul className="fi-ev-keys">
            {assignedTeams.map((team: any, i: number) => {
              const score = getTeamScoreStatus(team._id);
              const line = score
                ? `Scored · ${Number(score.totalScore.toFixed(2))} pts`
                : team.track || "Untracked";
              const isActive =
                activeTeamId != null &&
                String(activeTeamId) === String(team._id);
              return (
                <li key={team._id} className="fi-ev-key-wrap">
                  <Link
                    to={`/event/${eventId}?team=${team._id}`}
                    className="fi-ev-key"
                    aria-label={`Score ${team.name}${score ? ", already scored" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                    onMouseEnter={() => onHover({ name: team.name, line })}
                    onMouseLeave={() => onHover(null)}
                    onFocus={() => onHover({ name: team.name, line })}
                    onBlur={() => onHover(null)}
                  >
                    <span className="fi-ev-key-top">
                      <span
                        className={`fi-ev-key-led${score ? " is-lit" : ""}`}
                        aria-hidden="true"
                      />
                      <span className="fi-ev-key-num">
                        {score ? "Scored" : "To score"}
                      </span>
                    </span>
                    <span>
                      <span className="fi-ev-key-name">{team.name}</span>
                      <span className="fi-ev-key-team">{line}</span>
                    </span>
                  </Link>
                  {enableCohorts && !locked && !score && (
                    <button
                      type="button"
                      className="fi-ev-key-x"
                      aria-label={`Remove ${team.name} from queue`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onToggleTeam(team._id, true);
                      }}
                    >
                      <svg
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="square"
                          strokeLinejoin="miter"
                          strokeWidth={2}
                          d="M6 6l12 12M18 6L6 18"
                        />
                      </svg>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {showBrowse && (
        <section className="fi-ev-zone" aria-labelledby="fi-ev-browse-h">
          <div className="fi-ev-zone-head">
            <h2 className="fi-zone" id="fi-ev-browse-h">
              Browse teams
            </h2>
            {teams.length > 0 && !locked ? (
              <button
                type="button"
                className="fi-key fi-key--sm"
                onClick={onAddAllTeams}
              >
                Add all {teams.length} filtered{" "}
                {teams.length === 1 ? "team" : "teams"}
              </button>
            ) : (
              <span className="fi-engraved">
                {locked ? "Read-only" : `${pad2(teams.length)} available`}
              </span>
            )}
          </div>

          {teams.length === 0 ? (
            <p className="fi-engraved">No teams match your search</p>
          ) : (
            <div className="fi-ev-browse">
              {teams.map((team: any) => (
                <div key={team._id} className="fi-ev-browse-row">
                  <div>
                    <h3 className="fi-ev-browse-name">{team.name}</h3>
                    {team.description ? (
                      <p className="fi-ev-browse-desc">{team.description}</p>
                    ) : null}
                    {team.track ? (
                      <p className="fi-engraved-sm fi-ev-browse-meta">
                        {team.track}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="fi-key fi-key--sm"
                    onClick={() => onToggleTeam(team._id, false)}
                    disabled={locked}
                    aria-label={`Add ${team.name} to queue`}
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
