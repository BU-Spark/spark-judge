import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useEffect, useMemo, useState } from "react";
import { ScoringWizard } from "./ScoringWizard";
import { LoadingState } from "./ui/LoadingState";
import { ErrorState } from "./ui/ErrorState";

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

  // Filter teams by search query
  const filteredTeams = useMemo(() => {
    if (!searchQuery) return visibleTeams;
    return visibleTeams.filter((team: any) =>
      team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [visibleTeams, searchQuery]);

  const handleToggleTeam = async (teamId: Id<"teams">, isAssigned: boolean) => {
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

  if (event === undefined || judgeStatus === undefined || myScores === undefined || myAssignments === undefined) {
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

      <div className="card-glass mb-8 fade-in">
        <div className="mb-4">
          <h1 className="text-4xl font-heading font-bold text-foreground mb-2">{event.name}</h1>
          <p className="text-muted-foreground text-lg">{event.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {new Date(event.startDate).toLocaleDateString()} - {new Date(event.endDate).toLocaleDateString()}
          </span>
          <span className={`badge ${event.status === 'active' ? 'bg-green-500/20 text-green-600 border-green-500/30' : ''}`}>
            {event.status}
          </span>
        </div>
      </div>

      {event.status === "active" && enableCohorts && myAssignments && (
        <TeamSelectionSection
          teams={filteredTeams}
          myAssignments={myAssignments}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onToggleTeam={(teamId, isAssigned) => {
            void handleToggleTeam(teamId, isAssigned);
          }}
          onStartScoring={() => {
            if (myAssignments.length > 0) {
              setShowWizard(true);
            }
          }}
          canStart={myAssignments.length > 0}
        />
      )}

      {event.status === "active" && (
        <div className="card mb-8 fade-in">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-heading font-bold text-foreground mb-2">
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
              <button
                onClick={() => setShowWizard(true)}
                className={scoringComplete ? "btn-secondary" : "btn-primary"}
                disabled={(enableCohorts && myAssignments.length === 0) || totalTeams === 0 || scoringComplete}
              >
                {scoringComplete
                  ? "Scoring Complete"
                  : hasDraft
                  ? "Continue Scoring"
                  : completedCount > 0
                  ? "Resume Scoring"
                  : enableCohorts && myAssignments.length === 0
                  ? "Select Teams First"
                  : "Start Scoring"}
              </button>
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
          <h2 className="text-xl font-heading font-semibold mb-4">Your Score Summary</h2>
          <ScoreSummary scores={myScores} categories={event.categories.map(c => c.name)} />
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
      <div className="card-glass bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600 border-yellow-500/30 text-center slide-up">
        <div className="text-6xl mb-4">🏆</div>
        <h2 className="text-3xl font-heading font-bold text-gray-900 mb-2">Overall Winner</h2>
        {overallWinnerTeam && (
          <p className="text-2xl font-bold text-gray-900">{overallWinnerTeam.name}</p>
        )}
      </div>

      {event.categoryWinners && event.categoryWinners.length > 0 && (
        <div className="slide-up" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-2xl font-heading font-bold mb-6 text-foreground">Category Winners</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {event.categoryWinners.map((winner, index) => {
              const team = event.teams.find((t) => t._id === winner.teamId);
              return (
                <div 
                  key={winner.category} 
                  className="card-glass border-2 border-primary/50 bg-primary/5 hover:border-primary transition-all duration-300"
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

      <div className="slide-up" style={{ animationDelay: '0.3s' }}>
        <h2 className="text-2xl font-heading font-bold mb-6 text-foreground">All Scores</h2>
        <div className="card-glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Team
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Average Score
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
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
                        transition-colors hover:bg-muted/30
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
};

function ScoreSummary({ scores, categories }: ScoreSummaryProps) {
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

  // Score distribution
  const scoreDistribution = [1, 2, 3, 4, 5].map(score => {
    const count = scores.filter(s => s.totalScore === score * categories.length).length;
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
            {Math.round((averageScore / (categories.length * 5)) * 100)}%
          </div>
          <div className="text-sm text-muted-foreground">Score Ratio</div>
        </div>
      </div>

      {/* Category Averages */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Category Averages</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categoryAverages.map(({ category, average }) => (
            <div key={category} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
              <span className="font-medium">{category}</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
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
        <h3 className="text-lg font-semibold mb-3">Score Distribution</h3>
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
        <h3 className="text-lg font-semibold mb-3">Your Scores</h3>
        <div className="space-y-2">
          {scores.map((score) => (
            <div key={score.teamId} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="font-medium">Team {score.teamId.slice(-4)}</span>
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
              <span className="font-bold text-primary">
                {score.totalScore}/{categories.length * 5}
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
  myAssignments,
  searchQuery,
  setSearchQuery,
  onToggleTeam,
  onStartScoring,
  canStart,
}: {
  teams: Array<any>;
  myAssignments: Id<"teams">[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onToggleTeam: (teamId: Id<"teams">, isAssigned: boolean) => void;
  onStartScoring: () => void;
  canStart: boolean;
}) {
  return (
    <div className="card mb-8 fade-in">
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground mb-2">
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
            className="w-full pl-11 pr-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
          />
        </div>

        {/* Selected Teams Count */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Selected: <span className="font-semibold text-foreground">{myAssignments.length} teams</span>
          </span>
          <button
            onClick={onStartScoring}
            className="btn-primary"
            disabled={!canStart}
          >
            Start Scoring Selected Teams
          </button>
        </div>

        {/* Teams List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
          {teams.map((team: any) => {
            const isAssigned = myAssignments.includes(team._id);
            return (
              <div
                key={team._id}
                className={`border rounded-xl p-4 transition-all hover:shadow-md ${
                  isAssigned
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-foreground">{team.name}</h3>
                  <button
                    onClick={() => onToggleTeam(team._id, isAssigned)}
                    className={`p-2 rounded-lg transition-colors ${
                      isAssigned
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {isAssigned ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {team.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
