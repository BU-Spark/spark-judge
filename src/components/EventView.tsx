import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useEffect, useMemo, useState } from "react";
import { ScoringWizard } from "./ScoringWizard";
import { LoadingState } from "./ui/LoadingState";
import { ErrorState } from "./ui/ErrorState";
import { DemoDayBrowse } from "./demo-day";
import { formatDateTime } from "../lib/utils";

export function EventView({ eventId, onBack }: { eventId: Id<"events">; onBack: () => void }) {
  const event = useQuery(api.events.getEvent, { eventId });
  const judgeStatus = useQuery(api.events.getJudgeStatus, { eventId });
  const myScores = useQuery(api.scores.getMyScores, { eventId });
  const myAssignments = useQuery(api.judgeAssignments.getMyAssignments, { eventId });
  const addTeamToAssignment = useMutation(api.judgeAssignments.addTeamToAssignment);
  const removeTeamFromAssignment = useMutation(api.judgeAssignments.removeTeamFromAssignment);
  const [showWizard, setShowWizard] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const storageKey = judgeStatus
    ? `scoring_draft_${eventId}_${judgeStatus.userId}`
    : null;

  useEffect(() => {
    if (!storageKey) {
      setHasDraft(false);
      return;
    }
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      setHasDraft(!!raw);
    } catch {
      setHasDraft(false);
    }
  }, [storageKey, showWizard, myScores?.length]);

  // Check if cohorts are enabled
  const enableCohorts = event?.enableCohorts || false;
  
  const visibleTeams = useMemo(
    () => (event?.teams ?? []).filter((team: any) => !team.hidden),
    [event?.teams]
  );

  // Get assigned teams if cohorts enabled, otherwise all visible teams
  const teamsToJudge = useMemo(() => {
    if (!enableCohorts || !myAssignments) return visibleTeams;
    return visibleTeams.filter((team: any) => myAssignments.includes(team._id));
  }, [enableCohorts, visibleTeams, myAssignments]);

  const totalTeams = enableCohorts && myAssignments ? myAssignments.length : visibleTeams.length;
  const completedCount = myScores?.length ?? 0;
  const progressPercent =
    totalTeams === 0 ? 0 : Math.round((completedCount / totalTeams) * 100);
  const scoringComplete = totalTeams > 0 && completedCount >= totalTeams;

  // Filter teams by search query (only show unassigned teams or searching)
  const filteredTeams = useMemo(() => {
    const baseTeams = searchQuery 
      ? visibleTeams.filter((team: any) =>
          team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          team.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : visibleTeams;
    
    // If searching, show all matching teams. Otherwise show teams not in my queue
    if (searchQuery) return baseTeams;
    return baseTeams.filter((team: any) => !myAssignments?.includes(team._id));
  }, [visibleTeams, searchQuery, myAssignments]);

  // Get assigned teams (for the "My Queue" section)
  const assignedTeams = useMemo(() => {
    return visibleTeams.filter((team: any) => myAssignments?.includes(team._id));
  }, [visibleTeams, myAssignments]);

  // Check if judge has submitted scores (to lock queue)
  const hasSubmittedScores = myScores && myScores.length > 0;

  const handleToggleTeam = async (teamId: Id<"teams">, isAssigned: boolean) => {
    // Prevent changes after scores have been submitted
    if (hasSubmittedScores && isAssigned) {
      alert("You cannot remove teams from your queue after submitting scores.");
      return;
    }
    
    try {
      if (isAssigned) {
        await removeTeamFromAssignment({ eventId, teamId });
      } else {
        await addTeamToAssignment({ eventId, teamId });
      }
    } catch (error) {
      console.error("Failed to toggle team assignment:", error);
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

      <div className="card-static mb-8 fade-in">
        <div className="mb-4">
          <h1 className="text-3xl font-heading font-bold text-foreground mb-2">{event.name}</h1>
          <p className="text-muted-foreground text-lg">{event.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatDateTime(event.startDate)} - {formatDateTime(event.endDate)}
          </span>
          <span className={`badge ${event.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : ''}`}>
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
          onToggleTeam={(teamId, isAssigned) => {
            void handleToggleTeam(teamId, isAssigned);
          }}
          onStartScoring={() => {
            if (myAssignments && myAssignments.length > 0) {
              setShowWizard(true);
            }
          }}
          canStart={(myAssignments?.length ?? 0) > 0}
          locked={!!hasSubmittedScores}
          myScores={myScores}
        />
      )}

      {event.status === "active" && (
        <div className="card mb-8 fade-in">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-xl font-heading font-bold text-foreground mb-2">
                  {scoringComplete ? "Scoring Complete!" : completedCount > 0 ? "Keep Scoring" : "Ready to Score?"}
          </h2>
                {scoringComplete ? (
                  <p className="text-emerald-600 dark:text-emerald-400">
                    Thank you for judging. All teams have been scored.
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    {hasDraft
                      ? "You have a saved scoring session. Continue where you left off."
                      : `Score ${totalTeams} team${totalTeams === 1 ? "" : "s"} across ${
                          event.categories.length
                        } categories.`}
                  </p>
                )}
                <p className={`text-sm mt-2 ${scoringComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                  Progress: {completedCount} / {totalTeams} teams scored
                </p>
                {justSubmitted && (
                  <p className="text-xs text-muted-foreground mt-1">Your scores were submitted successfully.</p>
                )}
              </div>
              {!scoringComplete && (
                <button
                  onClick={() => setShowWizard(true)}
                  className="btn-primary"
                  disabled={(enableCohorts && myAssignments.length === 0) || totalTeams === 0}
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
            <div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${scoringComplete ? 'bg-emerald-500' : 'bg-primary'}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>Completed: {completedCount}</span>
                <span>Remaining: {Math.max(totalTeams - completedCount, 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Score Summary Section - Show when scoring is complete */}
      {scoringComplete && myScores && myScores.length > 0 && (
        <div className="card mb-8 fade-in">
          <h2 className="text-lg font-heading font-semibold mb-4">Your Score Summary</h2>
          <ScoreSummary 
            scores={myScores.map(score => {
              const team = visibleTeams.find(t => t._id === score.teamId);
              return { ...score, teamName: team?.name || 'Unknown Team' };
            })} 
            categories={event.categories.map(c => c.name)} 
            categoryWeights={event.categories}
          />
        </div>
      )}

      {event.status === "past" && event.resultsReleased && (
        <ResultsView eventId={eventId} />
      )}

      {showWizard && judgeStatus && (
        <ScoringWizard
          eventId={eventId}
          teams={teamsToJudge}
          categories={event.categories.map(c => c.name)}
          existingScores={myScores ?? []}
          storageKey={storageKey}
          onClose={() => setShowWizard(false)}
          onSubmitted={handleWizardSubmitted}
        />
      )}
    </div>
  );
}

function ResultsView({ eventId }: { eventId: Id<"events"> }) {
  const event = useQuery(api.events.getEvent, { eventId });
  const eventScores = useQuery(api.scores.getEventScores, { eventId });

  if (!event || !eventScores) return null;

  const overallWinnerTeam = event.overallWinner
    ? event.teams.find((t) => t._id === event.overallWinner)
    : null;

  return (
    <div className="space-y-8">
      <div className="card bg-amber-500/10 border-amber-500/20 text-center fade-in">
        <div className="text-6xl mb-4">🏆</div>
        <h2 className="text-3xl font-heading font-bold text-foreground mb-2">Overall Winner</h2>
        {overallWinnerTeam && (
          <p className="text-2xl font-bold text-amber-500">{overallWinnerTeam.name}</p>
        )}
      </div>

      {event.categoryWinners && event.categoryWinners.length > 0 && (
        <div className="fade-in" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-xl font-heading font-bold mb-6 text-foreground">Category Winners</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {event.categoryWinners.map((winner, index) => {
              const team = event.teams.find((t) => t._id === winner.teamId);
              return (
                <div 
                  key={winner.category} 
                  className="card border-primary/20 bg-primary/5 transition-all duration-300"
                  style={{ animationDelay: `${0.2 + index * 0.1}s` }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-heading font-semibold text-foreground">{winner.category}</h3>
                    <span className="text-2xl">🥇</span>
                  </div>
                  <p className="text-xl font-bold text-primary">{team?.name}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="fade-in" style={{ animationDelay: '0.3s' }}>
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
                  const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
                  return (
                    <tr 
                      key={teamScore.team._id} 
                      className={`
                        transition-colors hover:bg-muted/50
                        ${index < 3 ? 'bg-primary/5' : ''}
                      `}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-foreground">
                        <span className="flex items-center gap-2">
                          #{index + 1}
                          {medal && <span className="text-lg">{medal}</span>}
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
  )
}

type ScoreSummaryProps = {
  scores: any[];
  categories: string[];
  categoryWeights?: Array<{ name: string; weight: number }>;
};

function ScoreSummary({ scores, categories, categoryWeights }: ScoreSummaryProps) {
  // Calculate max possible weighted score
  const maxPossibleWeightedScore = categoryWeights?.reduce((sum, cat) => sum + (5 * cat.weight), 0) || categories.length * 5;
  
  // Calculate statistics
  const totalScores = scores.length;
  const averageScore = totalScores > 0 
    ? scores.reduce((sum, score) => sum + score.totalScore, 0) / totalScores 
    : 0;
  
  // Calculate category averages
  const categoryAverages = categories.map(category => {
    const categoryScores = scores.flatMap(s => 
      s.categoryScores.filter((cs: any) => cs.category === category)
    );
    const avg = categoryScores.length > 0
      ? categoryScores.reduce((sum: number, cs: any) => sum + cs.score, 0) / categoryScores.length
      : 0;
    return { category, average: avg };
  });

  // Score distribution (use weighted max score for buckets)
  const scoreDistribution = [1, 2, 3, 4, 5].map(score => {
    const threshold = score * (maxPossibleWeightedScore / 5);
    const count = scores.filter(s => {
      // Bucket by approximate position in the range
      return s.totalScore >= (threshold - maxPossibleWeightedScore / 10) && s.totalScore < (threshold + maxPossibleWeightedScore / 10);
    }).length;
    return { score, count, percentage: totalScores > 0 ? (count / totalScores) * 100 : 0 };
  });

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center p-4 bg-muted/30 rounded-lg">
          <div className="text-2xl font-bold text-primary">{totalScores}</div>
          <div className="text-sm text-muted-foreground">Teams Scored</div>
        </div>
        <div className="text-center p-4 bg-muted/30 rounded-lg">
          <div className="text-2xl font-bold text-primary">{averageScore.toFixed(1)}</div>
          <div className="text-sm text-muted-foreground">Average Score</div>
        </div>
        <div className="text-center p-4 bg-muted/30 rounded-lg">
          <div className="text-2xl font-bold text-primary">
            {Math.round((averageScore / maxPossibleWeightedScore) * 100)}%
          </div>
          <div className="text-sm text-muted-foreground">Score Ratio</div>
          <div className="text-xs text-muted-foreground mt-1">% of max possible</div>
        </div>
      </div>

      {/* Category Averages */}
      <div>
        <h3 className="text-base font-semibold mb-3">Category Averages</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categoryAverages.map(({ category, average }) => (
            <div key={category} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
              <span className="font-medium text-sm">{category}</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${(average / 5) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-mono font-bold w-8 text-right">
                  {average.toFixed(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Score Distribution */}
      <div>
        <h3 className="text-base font-semibold mb-3">Score Distribution</h3>
        <div className="space-y-2">
          {scoreDistribution.map(({ score, count, percentage }) => (
            <div key={score} className="flex items-center gap-3">
              <span className="w-8 text-sm font-medium">{score}</span>
              <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-12 text-sm text-muted-foreground text-right">
                {count} ({percentage.toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Individual Scores */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">Your Scores</h3>
          <span className="text-xs text-muted-foreground">*Totals include category weights</span>
        </div>
        <div className="space-y-2">
          {scores.map((score) => (
            <div key={score.teamId} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="font-medium text-sm">{score.teamName || 'Unknown Team'}</span>
                <div className="flex gap-1">
                  {score.categoryScores.map((cs: any, index: number) => (
                    <span 
                      key={index}
                      className="px-2 py-1 text-xs bg-primary/20 text-primary rounded"
                    >
                      {cs.category}: {cs.score}
                    </span>
                  ))}
                </div>
              </div>
              <span className="font-bold text-primary text-sm">
                {score.totalScore.toFixed(1)}/{maxPossibleWeightedScore.toFixed(1)}
              </span>
            </div>
          ))}
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
  onToggleTeam,
  onStartScoring,
  canStart,
  locked,
  myScores,
}: {
  teams: Array<any>;
  assignedTeams: Array<any>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onToggleTeam: (teamId: Id<"teams">, isAssigned: boolean) => void;
  onStartScoring: () => void;
  canStart: boolean;
  locked: boolean;
  myScores?: Array<any>;
}) {
  const getTeamScoreStatus = (teamId: Id<"teams">) => {
    if (!myScores) return null;
    return myScores.find((score: any) => score.teamId === teamId);
  };
  return (
    <div className="card mb-8 fade-in">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-heading font-bold text-foreground mb-2">
            Select Your Teams to Judge
          </h2>
          <p className="text-muted-foreground">
            Choose which teams you'll score. You can change this later if needed.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground text-sm"
          />
        </div>

        {/* My Queue Section */}
        {assignedTeams.length > 0 && (
          <div>
            <h3 className="text-lg font-heading font-semibold text-foreground mb-3">
              My Queue ({assignedTeams.length} teams)
            </h3>
            <div className="divide-y divide-border bg-muted/30 rounded-lg overflow-hidden border border-border">
              {assignedTeams.map((team: any) => {
                const score = getTeamScoreStatus(team._id);
                return (
                  <div
                    key={team._id}
                    className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {score && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                      )}
                      <div>
                        <span className="font-medium text-foreground">{team.name}</span>
                        {score && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Scored: {score.totalScore} points
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
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-heading font-semibold text-foreground">
              Browse Teams
            </h3>
            <button
              onClick={onStartScoring}
              className="btn-primary"
              disabled={!canStart || locked}
            >
              {locked ? "Scoring Complete" : "Start Scoring Selected Teams"}
            </button>
          </div>

          {teams.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {searchQuery ? "No teams match your search" : "All teams have been added to your queue"}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
              {teams.map((team: any) => {
                return (
                  <div
                    key={team._id}
                    className="border border-border rounded-lg p-4 transition-all hover:shadow-sm bg-background"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-foreground">{team.name}</h3>
                      <button
                        onClick={() => onToggleTeam(team._id, false)}
                        className="p-2 bg-muted text-muted-foreground hover:bg-muted/80 rounded-lg transition-colors"
                        disabled={locked}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {team.description}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
