import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useEffect, useMemo, useState } from "react";
import { ScoringWizard } from "./ScoringWizard";

export function EventView({ eventId, onBack }: { eventId: Id<"events">; onBack: () => void }) {
  const event = useQuery(api.events.getEvent, { eventId });
  const judgeStatus = useQuery(api.events.getJudgeStatus, { eventId });
  const myScores = useQuery(api.scores.getMyScores, { eventId });
  const [showWizard, setShowWizard] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

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

  const visibleTeams = useMemo(
    () => (event?.teams ?? []).filter((team: any) => !team.hidden),
    [event?.teams]
  );

  const totalTeams = visibleTeams.length;
  const completedCount = myScores?.length ?? 0;
  const progressPercent =
    totalTeams === 0 ? 0 : Math.round((completedCount / totalTeams) * 100);
  const scoredTeamIds = new Set(myScores?.map((s) => s.teamId) || []);
  const scoringComplete = totalTeams > 0 && completedCount >= totalTeams;

  const handleWizardSubmitted = () => {
    setShowWizard(false);
    setHasDraft(false);
    setJustSubmitted(true);
  };

  if (event === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (event === null) {
    return (
      <div className="max-w-2xl mx-auto mt-16 px-4">
        <div className="card text-center fade-in">
          <h2 className="text-2xl font-heading font-bold mb-4 text-foreground">Event Not Found</h2>
          <p className="text-muted-foreground mb-6">
            This event is no longer available.
          </p>
          <button onClick={onBack} className="btn-secondary">
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  if (judgeStatus === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!judgeStatus) {
    return (
      <div className="max-w-2xl mx-auto mt-16 px-4">
        <div className="card text-center fade-in">
          <h2 className="text-2xl font-heading font-bold mb-4 text-foreground">Not Registered</h2>
          <p className="text-muted-foreground mb-6">You are not registered as a judge for this event.</p>
          <button
            onClick={onBack}
            className="btn-secondary"
          >
            Back to Events
          </button>
        </div>
      </div>
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
                disabled={totalTeams === 0 || scoringComplete}
              >
                {scoringComplete
                  ? "Scoring Complete"
                  : hasDraft
                  ? "Continue Scoring"
                  : completedCount > 0
                  ? "Resume Scoring"
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

      {event.status === "past" && event.resultsReleased && (
        <ResultsView eventId={eventId} />
      )}

      {showWizard && judgeStatus && (
        <ScoringWizard
          eventId={eventId}
          teams={visibleTeams}
          categories={event.categories}
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
  );
}
