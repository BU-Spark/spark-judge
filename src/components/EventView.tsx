import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useEffect, useMemo, useState } from "react";
import { ScoringWizard } from "./ScoringWizard";
import { LoadingState } from "./ui/LoadingState";
import { ErrorState } from "./ui/ErrorState";
import { MedalIcon, TrophyIcon } from "./ui/AppIcons";
import { DemoDayBrowse } from "./demo-day";
import { formatDateTime } from "../lib/utils";
import { toast } from "sonner";

export function EventView({ eventId, onBack }: { eventId: Id<"events">; onBack: () => void }) {
  const event = useQuery(api.events.getEvent, { eventId });
  const judgeStatus = useQuery(api.events.getJudgeStatus, { eventId });
  const myScores = useQuery(api.scores.getMyScores, { eventId });
  const myAssignments = useQuery(api.judgeAssignments.getMyAssignments, { eventId });
  const addTeamToAssignment = useMutation(api.judgeAssignments.addTeamToAssignment);
  const addMultipleTeamsToAssignment = useMutation(api.judgeAssignments.addMultipleTeamsToAssignment);
  const removeTeamFromAssignment = useMutation(api.judgeAssignments.removeTeamFromAssignment);
  const [showWizard, setShowWizard] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftCompletedCount, setDraftCompletedCount] = useState(0);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [trackFilter, setTrackFilter] = useState("");
  const [sponsorFilter, setSponsorFilter] = useState("");
  const [prizeFilter, setPrizeFilter] = useState("");

  const eventPrizes = useQuery(api.prizes.listEventPrizes, { eventId }) || [];
  const eventPrizeSubmissions = useQuery(api.prizes.getEventPrizeSubmissions, { eventId }) || [];

  const storageKey = judgeStatus
    ? `scoring_draft_${eventId}_${judgeStatus.userId}`
    : null;

  const statusStyles: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    upcoming: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    past: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  };

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
        // Completed teams array from the draft payload
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

  // Check if cohorts are enabled
  const enableCohorts = event?.enableCohorts || false;
  const scoringLocked = !!event?.scoringLockedAt;

  const visibleTeams = useMemo(
    () => (event?.teams ?? []).filter((team: any) => !team.hidden),
    [event?.teams]
  );

  // Get assigned teams if cohorts enabled, otherwise all visible teams
  const teamsToJudge = useMemo(() => {
    if (!enableCohorts || !myAssignments) return visibleTeams;
    return visibleTeams.filter((team: any) => myAssignments.includes(team._id));
  }, [enableCohorts, visibleTeams, myAssignments]);

  const relevantTeamIds = useMemo(
    () => new Set(teamsToJudge.map((team: any) => String(team._id))),
    [teamsToJudge]
  );

  const totalTeams = teamsToJudge.length;
  // If we have a draft, rely on its completion count since it includes unsubmitted work.
  // Otherwise, fallback to the database committed scores length.
  const completedCount = hasDraft
    ? draftCompletedCount
    : (myScores?.filter((score: any) => relevantTeamIds.has(String(score.teamId))).length ?? 0);

  const progressPercent =
    totalTeams === 0 ? 0 : Math.round((completedCount / totalTeams) * 100);
  const scoringComplete = totalTeams > 0 && completedCount >= totalTeams;

  const trackOptions = useMemo(
    () => Array.from(new Set(visibleTeams.map((t: any) => t.track).filter(Boolean))).sort(),
    [visibleTeams]
  );

  const sponsorOptions = useMemo(
    () => Array.from(new Set(eventPrizes.map((p: any) => p.sponsorName).filter(Boolean))).sort(),
    [eventPrizes]
  );

  // Filter teams by search query and new filters
  const filteredTeams = useMemo(() => {
    let baseTeams = visibleTeams;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      baseTeams = baseTeams.filter((team: any) =>
        team.name.toLowerCase().includes(q) ||
        team.description.toLowerCase().includes(q)
      );
    }

    if (trackFilter) {
      baseTeams = baseTeams.filter((team: any) => team.track === trackFilter);
    }

    if (sponsorFilter) {
      const matchingPrizeIds = new Set(
        eventPrizes
          .filter((p: any) => p.sponsorName === sponsorFilter)
          .map((p: any) => p._id)
      );
      const teamIdsWithSponsor = new Set(
        eventPrizeSubmissions
          .filter((s: any) => matchingPrizeIds.has(s.prizeId))
          .map((s: any) => s.teamId)
      );
      baseTeams = baseTeams.filter((team: any) => teamIdsWithSponsor.has(team._id));
    }

    if (prizeFilter) {
      const teamIdsWithPrize = new Set(
        eventPrizeSubmissions
          .filter((s: any) => s.prizeId === prizeFilter)
          .map((s: any) => s.teamId)
      );
      baseTeams = baseTeams.filter((team: any) => teamIdsWithPrize.has(team._id));
    }

    // Always filter out teams already in the judge's queue
    return baseTeams.filter((team: any) => !myAssignments?.includes(team._id));
  }, [visibleTeams, searchQuery, trackFilter, sponsorFilter, prizeFilter, myAssignments, eventPrizes, eventPrizeSubmissions]);

  // Get assigned teams (for the "My Queue" section)
  const assignedTeams = useMemo(() => {
    return visibleTeams.filter((team: any) => myAssignments?.includes(team._id));
  }, [visibleTeams, myAssignments]);

  // Check if judge has submitted scores (to lock queue)
  const hasSubmittedScores = myScores && myScores.length > 0;

  const handleToggleTeam = async (teamId: Id<"teams">, isAssigned: boolean) => {
    if (scoringLocked) {
      alert("Scoring has been locked by an admin. Team assignments can no longer be changed.");
      return;
    }

    // Prevent removing a team that already has a submitted score
    if (isAssigned) {
      const teamHasBeenScored = myScores?.some((s: any) => s.teamId === teamId);
      if (teamHasBeenScored) {
        toast.error("You cannot remove a team after you have already submitted scores for them.");
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
      alert("Scoring has been locked by an admin. Team assignments can no longer be changed.");
      return;
    }
    try {
      const teamIds = filteredTeams.map((t: any) => t._id);
      const addedCount = await addMultipleTeamsToAssignment({ eventId, teamIds });
      if (addedCount > 0) {
        toast.success(`Added ${addedCount} team${addedCount === 1 ? '' : 's'} to your queue!`);
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
  };

  // Loading state - for Demo Day mode, we only need the event
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

  // Demo Day Mode - render the browse experience (no judge auth required)
  if (event.mode === "demo_day") {
    return <DemoDayBrowse eventId={eventId} event={event} onBack={onBack} />;
  }

  // Hackathon Mode - requires judge authentication
  if (judgeStatus === undefined || myScores === undefined || myAssignments === undefined) {
    return <LoadingState label="Loading judge details..." />;
  }

  if (!judgeStatus) {
    return (
      <ErrorState
        title="Not registered"
        description="You are not registered as a judge for this event."
        actionLabel="Back to events"
        onAction={onBack}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <button
        onClick={onBack}
        className="flex items-center gap-2 btn-ghost mb-6 fade-in"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Events
      </button>

      <div className="mb-8 fade-in space-y-2">
        <h1 className="text-3xl font-heading font-bold text-foreground">{event.name}</h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatDateTime(event.startDate)} - {formatDateTime(event.endDate)}
          </span>
          <span className={`badge ${statusStyles[event.status] || statusStyles.upcoming}`}>
            {event.status}
          </span>
        </div>
      </div>

      {event.status === "active" && enableCohorts && myAssignments && (
        <TeamSelectionSection
          teams={filteredTeams}
          assignedTeams={assignedTeams}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          trackFilter={trackFilter}
          setTrackFilter={setTrackFilter}
          sponsorFilter={sponsorFilter}
          setSponsorFilter={setSponsorFilter}
          prizeFilter={prizeFilter}
          setPrizeFilter={setPrizeFilter}
          trackOptions={trackOptions as string[]}
          sponsorOptions={sponsorOptions as string[]}
          eventPrizes={eventPrizes}
          onToggleTeam={(teamId, isAssigned) => {
            void handleToggleTeam(teamId, isAssigned);
          }}
          onAddAllTeams={handleAddAllTeams}
          onStartScoring={() => {
            if (scoringLocked) return;
            if (myAssignments && myAssignments.length > 0) {
              setShowWizard(true);
            }
          }}
          canStart={(myAssignments?.length ?? 0) > 0}
          locked={scoringLocked}
          myScores={myScores}
        />
      )}

      {event.status === "active" && scoringLocked && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-300">
          Scoring is locked for this event. Judges can view scores, but edits are disabled until an admin unlocks scoring.
        </div>
      )}

      {event.status === "active" && (
        <div className="card p-4 md:px-6 mb-6 fade-in sticky bottom-4 z-40 shadow-xl border-primary/20 backdrop-blur-md bg-card/95">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-xl font-heading font-bold text-foreground">
                {scoringLocked
                  ? "Scoring Locked"
                  : scoringComplete
                    ? "Scoring Complete!"
                    : completedCount > 0
                      ? "Keep Scoring"
                      : "Ready to Score?"}
              </h2>
              {scoringLocked ? (
                <p className="text-amber-700 dark:text-amber-300">
                  Score updates are disabled while deliberation is in progress.
                </p>
              ) : scoringComplete ? (
                <p className="text-emerald-600 dark:text-emerald-400">
                  Thank you for judging. All teams have been scored.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  {hasDraft
                    ? "You have a saved scoring session. Continue where you left off."
                    : `Score ${totalTeams} team${totalTeams === 1 ? "" : "s"} across ${event.categories.length
                    } categories.`}
                </p>
              )}
              <p className={`text-sm ${scoringComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                Progress: {completedCount} / {totalTeams} teams scored
              </p>
              {justSubmitted && (
                <p className="text-xs text-muted-foreground mt-1">Your scores were submitted successfully.</p>
              )}
            </div>
            {!scoringLocked && (
              <div className="flex flex-col sm:flex-row gap-3 mt-4 md:mt-0 items-center">
                {scoringComplete ? (
                  <>
                    <button
                      onClick={() => window.location.href = '/'}
                      className="btn-primary whitespace-nowrap"
                    >
                      Return to Dashboard
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowWizard(true)}
                        className="btn-secondary whitespace-nowrap text-sm px-3 py-1.5"
                        disabled={(enableCohorts && myAssignments.length === 0) || totalTeams === 0 || scoringLocked}
                      >
                        Review Scores
                      </button>
                      <button
                        onClick={() => {
                          window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
                        }}
                        className="btn-ghost whitespace-nowrap text-sm px-3 py-1.5"
                        disabled={scoringLocked}
                      >
                        Add More Teams
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => setShowWizard(true)}
                    className="btn-primary whitespace-nowrap"
                    disabled={(enableCohorts && myAssignments.length === 0) || totalTeams === 0 || scoringLocked}
                  >
                    {hasDraft
                      ? "Continue Scoring"
                      : completedCount > 0
                        ? "Resume Scoring"
                        : enableCohorts && myAssignments.length === 0
                          ? "Select Teams First"
                          : "Start Scoring"}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="space-y-2 mt-4 md:mt-0">
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${scoringLocked
                  ? "bg-amber-500"
                  : scoringComplete
                    ? "bg-emerald-500"
                    : "bg-primary"
                  }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Completed: {completedCount}</span>
              <span>Remaining: {Math.max(totalTeams - completedCount, 0)}</span>
            </div>
          </div>
        </div>
      )}



      {
        event.status === "past" && event.resultsReleased && (
          <ResultsView eventId={eventId} />
        )
      }

      {
        showWizard && judgeStatus && !scoringLocked && (
          <ScoringWizard
            eventId={eventId}
            teams={teamsToJudge}
            categories={event.categories.map((c: any) => ({
              name: c.name,
              optOutAllowed: c.optOutAllowed,
            }))}
            existingScores={myScores ?? []}
            storageKey={storageKey}
            onClose={() => setShowWizard(false)}
            onSubmitted={handleWizardSubmitted}
          />
        )
      }
    </div >
  );
}

function ResultsView({ eventId }: { eventId: Id<"events"> }) {
  const event = useQuery(api.events.getEvent, { eventId });
  const eventScores = useQuery(api.scores.getEventScores, { eventId });
  const prizeWinners = useQuery(api.prizes.listPrizeWinners, { eventId });

  if (!event || !eventScores || prizeWinners === undefined) return null;

  const overallWinnerTeam = event.overallWinner
    ? event.teams.find((t) => t._id === event.overallWinner)
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
    <div className="space-y-8">
      {hasPrizeWinners ? (
        <div className="fade-in space-y-4">
          <div>
            <h2 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
              <TrophyIcon className="h-6 w-6 text-primary" />
              Prize Winners
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Final placements after judge deliberation.
            </p>
          </div>

          <div className="card overflow-hidden">
            <div className="divide-y divide-border">
              {Object.values(groupedPrizeWinners).map((winnerRows: any[]) => {
                const first = winnerRows[0];
                const prizeName = first?.prize?.name || "Prize";
                return (
                  <div key={first.prizeId} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-muted/30 transition-colors bg-card">
                    <div className="sm:w-1/3 flex items-center gap-3">
                      <MedalIcon className="h-5 w-5 text-primary shrink-0" />
                      <h3 className="font-medium text-foreground leading-tight">
                        {prizeName}
                      </h3>
                    </div>
                    <div className="sm:w-2/3 flex flex-wrap gap-2">
                      {winnerRows
                        .sort((a: any, b: any) => (a.placement ?? 999) - (b.placement ?? 999))
                        .map((row: any) => (
                          <div key={row._id} className="inline-flex flex-col bg-background border border-border rounded-md px-3 py-2 flex-1 min-w-[140px] max-w-[200px]">
                            <span className="font-semibold text-sm text-foreground truncate">{row.team?.name || "Unknown Team"}</span>
                            {typeof row.placement === "number" ? (
                              <span className="text-xs text-muted-foreground mt-0.5">Placement: {row.placement}</span>
                            ) : row.notes ? (
                              <span className="text-xs text-muted-foreground mt-0.5 truncate">{row.notes}</span>
                            ) : null}
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6 fade-in">
          <div className="card p-6 flex-1 flex flex-col justify-center items-center text-center border-primary/20 bg-primary/5">
            <TrophyIcon className="h-10 w-10 text-primary mb-3" />
            <h2 className="text-sm font-medium text-primary uppercase tracking-wider mb-2">Overall Winner</h2>
            {overallWinnerTeam ? (
              <p className="text-2xl font-bold text-foreground">{overallWinnerTeam.name}</p>
            ) : (
              <p className="text-2xl font-bold text-muted-foreground">TBD</p>
            )}
          </div>

          {event.categoryWinners && event.categoryWinners.length > 0 && (
            <div className="card flex-[2] overflow-hidden">
              <div className="bg-muted/50 px-5 py-4 border-b border-border">
                <h2 className="font-heading font-semibold text-foreground flex items-center gap-2">
                  <MedalIcon className="h-5 w-5 text-primary" />
                  Category Winners
                </h2>
              </div>
              <div className="divide-y divide-border">
                {event.categoryWinners.map((winner, index) => {
                  const team = event.teams.find((t) => t._id === winner.teamId);
                  return (
                    <div key={winner.category} className="px-5 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors bg-card">
                      <span className="text-sm font-medium text-muted-foreground">{winner.category}</span>
                      <span className="font-semibold text-foreground">{team?.name || "Unknown"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="fade-in" style={{ animationDelay: "0.3s" }}>
        <h2 className="text-xl font-heading font-bold mb-6 text-foreground">All Scores</h2>
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
                    Rank
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
                    Team
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
                    Average Score
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
                    Judges
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {eventScores.map((teamScore, index) => {
                  return (
                    <tr
                      key={teamScore.team._id}
                      className="transition-colors hover:bg-muted/50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-foreground">
                        <span className="flex items-center gap-2">
                          #{index + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-foreground">
                        {teamScore.team.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        <span className="font-mono font-bold">{teamScore.averageScore.toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {teamScore.judgeCount} {teamScore.judgeCount === 1 ? 'judge' : 'judges'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}


function TeamSelectionSection({
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
  trackOptions,
  sponsorOptions,
  eventPrizes,
  onToggleTeam,
  onAddAllTeams,
  onStartScoring,
  canStart,
  locked,
  myScores,
}: {
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
  trackOptions: string[];
  sponsorOptions: string[];
  eventPrizes: Array<any>;
  onToggleTeam: (teamId: Id<"teams">, isAssigned: boolean) => void;
  onAddAllTeams: () => void;
  onStartScoring: () => void;
  canStart: boolean;
  locked: boolean;
  myScores?: Array<any>;
}) {
  const getTeamScoreStatus = (teamId: Id<"teams">) => {
    if (!myScores) return null;
    return myScores.find((score: any) => String(score.teamId) === String(teamId));
  };
  return (
    <div className="card p-6 mb-8 fade-in">
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-heading font-bold text-foreground">
            Select Your Teams to Judge
          </h2>
          <p className="text-muted-foreground">
            {locked
              ? "Scoring is locked. Team assignments are currently read-only."
              : "Choose which teams you'll score. You can change this later if needed."}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input flex-1"
          />
          <select
            value={trackFilter}
            onChange={(e) => setTrackFilter(e.target.value)}
            className="input sm:w-48"
          >
            <option value="">All Tracks</option>
            {trackOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={sponsorFilter}
            onChange={(e) => setSponsorFilter(e.target.value)}
            className="input sm:w-48"
          >
            <option value="">All Sponsors</option>
            {sponsorOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {eventPrizes.filter(p => ["track", "sponsor", "track_sponsor"].includes(p.type)).length > 0 && (
            <select
              value={prizeFilter}
              onChange={(e) => setPrizeFilter(e.target.value)}
              className="input sm:w-48"
            >
              <option value="">All Prizes</option>
              {eventPrizes
                .filter(p => ["track", "sponsor", "track_sponsor"].includes(p.type))
                .map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          )}
        </div>

        {/* My Queue Section */}
        {assignedTeams.length > 0 && (
          <div>
            <h3 className="text-lg font-heading font-semibold text-foreground mb-3">
              My Queue ({assignedTeams.length} teams)
            </h3>
            <div className="divide-y divide-border bg-muted/30 rounded-lg overflow-hidden border border-border max-h-[400px] overflow-y-auto custom-scrollbar">
              {assignedTeams.map((team: any) => {
                const score = getTeamScoreStatus(team._id);
                return (
                  <div
                    key={team._id}
                    className="px-4 py-3 flex items-center justify-between hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {score && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                      )}
                      <div>
                        <span className="font-medium text-foreground">{team.name}</span>
                        {score && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Scored: {Number(score.totalScore.toFixed(2))} points
                          </div>
                        )}
                      </div>
                    </div>
                    {!locked && (
                      <button
                        onClick={() => onToggleTeam(team._id, true)}
                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Add Teams Section */}
        {(teams.length > 0 || searchQuery) && (
          <div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-3">
              <h3 className="text-lg font-heading font-semibold text-foreground">Browse Teams</h3>
              {teams.length > 0 && !locked && (
                <button
                  onClick={onAddAllTeams}
                  className="btn-secondary text-sm py-1.5 px-3 whitespace-nowrap"
                >
                  Add All {teams.length} Filtered {teams.length === 1 ? 'Team' : 'Teams'}
                </button>
              )}
            </div>

            {teams.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-2">
                No teams match your search
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                {teams.map((team: any) => {
                  return (
                    <div
                      key={team._id}
                      className="border border-border rounded-lg p-4 transition-all hover:shadow-md bg-background flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-foreground">{team.name}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {team.description}
                          </p>
                        </div>
                        <button
                          onClick={() => onToggleTeam(team._id, false)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted/70 text-foreground hover:bg-muted transition-colors shadow-sm shrink-0"
                          disabled={locked}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
