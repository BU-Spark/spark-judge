import type { ReactNode } from "react";
import { WinnersSection } from "../sections/WinnersSection";

export function ScoresTab({
  isDemoDayMode,
  eventStatus,
  resultsReleased,
  eventScores,
  scoringLocked,
  lockingScores,
  hasConfiguredPrizes,
  prizeDeliberationReady,
  onFinishEvent,
  onToggleScoringLock,
  onOpenWinners,
  onReleaseResults,
  isPageLayout,
  scoresView,
  onBackToScores,
  winnersContent,
  appreciationSummary,
  onExportAppreciationsCsv,
  onDownloadQrCodes,
  isGeneratingQr,
  detailedScores,
  viewMode,
  setViewMode,
  ScoringDashboard,
  MedalIcon,
  BarChartIcon,
  LightbulbIcon,
}: {
  isDemoDayMode: boolean;
  eventStatus: "upcoming" | "active" | "past";
  resultsReleased: boolean;
  eventScores: any[] | undefined;
  scoringLocked: boolean;
  lockingScores: boolean;
  hasConfiguredPrizes: boolean;
  prizeDeliberationReady: boolean;
  onFinishEvent: () => void;
  onToggleScoringLock: () => void;
  onOpenWinners: () => void;
  onReleaseResults: () => void;
  isPageLayout: boolean;
  scoresView: "overview" | "winners";
  onBackToScores: () => void;
  winnersContent: ReactNode;
  appreciationSummary: any;
  onExportAppreciationsCsv: () => void;
  onDownloadQrCodes: () => void;
  isGeneratingQr: boolean;
  detailedScores: any;
  viewMode: "table" | "chart";
  setViewMode: (mode: "table" | "chart") => void;
  ScoringDashboard: (props: any) => ReactNode;
  MedalIcon: (props: any) => ReactNode;
  BarChartIcon: (props: any) => ReactNode;
  LightbulbIcon: (props: any) => ReactNode;
}) {
  return (
    <>

      <div className="flex flex-col md:flex-row md:items-center justify-between p-4 mb-6 rounded-lg border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 mb-4 md:mb-0">
          <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${resultsReleased ? 'bg-slate-400' : isDemoDayMode ? 'bg-pink-500 animate-pulse' : !scoringLocked ? 'bg-teal-500 animate-pulse' : 'bg-amber-500'}`} />
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {resultsReleased ? "Event Complete" : isDemoDayMode ? "Demo Day Active" : scoringLocked ? "Scoring Locked" : "Judging in Progress"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {resultsReleased
                ? "Results have been released to all participants."
                : isDemoDayMode
                  ? "Review appreciations, select winners, and release results."
                  : scoringLocked
                    ? hasConfiguredPrizes ? "Run the winner wizard to assign prizes, then release results." : "Add at least one prize in the Prizes tab to run the winner wizard."
                    : "Lock scoring before selecting winners or releasing results."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto">
          {/* Secondary Actions */}
          {eventStatus === "active" && (
            <button
              onClick={onFinishEvent}
              className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
            >
              Finish Event
            </button>
          )}

          {!isDemoDayMode && scoringLocked && (
            <button
              onClick={onToggleScoringLock}
              disabled={lockingScores}
              className="px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-md transition-colors disabled:opacity-50"
            >
              {lockingScores ? "Unlocking..." : "Unlock Scores"}
            </button>
          )}

          {/* Primary Actions */}
          {!isDemoDayMode && !scoringLocked && (
            <button
              onClick={onToggleScoringLock}
              disabled={lockingScores}
              className="px-4 py-1.5 text-sm font-medium bg-foreground text-background hover:bg-foreground/90 rounded-md transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.105 0 2-.895 2-2V7a2 2 0 10-4 0v2c0 1.105.895 2 2 2zm-6 2a2 2 0 012-2h8a2 2 0 012 2v6H6v-6z" />
              </svg>
              {lockingScores ? "Locking..." : "Lock Scores"}
            </button>
          )}

          {(scoringLocked || isDemoDayMode) && !resultsReleased && (
            <>
              <button
                onClick={onOpenWinners}
                disabled={!isDemoDayMode && (!scoringLocked || !hasConfiguredPrizes || !prizeDeliberationReady)}
                className="px-4 py-1.5 text-sm font-medium border border-border bg-card text-foreground hover:bg-muted/50 rounded-md transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                {isDemoDayMode ? "Select Winners" : "Winner Wizard"}
              </button>

              <button
                onClick={onReleaseResults}
                disabled={resultsReleased}
                className="px-4 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Release Results
              </button>
            </>
          )}

          {resultsReleased && (
            <span className="px-4 py-1.5 text-sm font-medium border border-border bg-muted/30 text-muted-foreground rounded-md flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Results Released
            </span>
          )}
        </div>
      </div>

      {isPageLayout && scoresView === "winners" ? (
        <WinnersSection>
          {winnersContent}
        </WinnersSection>
      ) : isDemoDayMode ? (
        appreciationSummary ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card-static p-6 bg-card text-center">
                <div className="text-3xl font-bold text-pink-500">{appreciationSummary.totalAppreciations}</div>
                <div className="text-sm text-muted-foreground mt-1">Total Appreciations</div>
              </div>
              <div className="card-static p-6 bg-card text-center">
                <div className="text-3xl font-bold text-foreground">{appreciationSummary.uniqueAttendees}</div>
                <div className="text-sm text-muted-foreground mt-1">Unique Attendees</div>
              </div>
              <div className="card-static p-6 bg-card text-center">
                <div className="text-3xl font-bold text-foreground">{appreciationSummary.teams.length}</div>
                <div className="text-sm text-muted-foreground mt-1">Projects</div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={onExportAppreciationsCsv} className="btn-secondary flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export CSV
              </button>
              <button
                onClick={onDownloadQrCodes}
                disabled={isGeneratingQr}
                className="bg-pink-500 hover:bg-pink-600 text-white font-medium px-4 py-2 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingQr ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    Download QR Codes
                  </>
                )}
              </button>
            </div>

            <div className="card-static p-6 bg-card">
              <h4 className="text-xl font-heading font-bold text-foreground mb-4">Project Rankings</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="bg-muted/20 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">Rank</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">Project</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">Course</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">Appreciations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {appreciationSummary.teams.map((team: any, index: number) => (
                      <tr key={team.teamId} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-sm font-bold text-foreground">
                          <span className="flex items-center gap-2">
                            #{index + 1}
                            {index === 0 && <MedalIcon className="h-5 w-5 text-amber-500" />}
                            {index === 1 && <MedalIcon className="h-5 w-5 text-slate-400" />}
                            {index === 2 && <MedalIcon className="h-5 w-5 text-orange-500" />}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-foreground">{team.teamName}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{team.courseCode || "-"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-pink-500">❤️</span>
                            <span className="font-bold text-foreground">{team.rawScore}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="card-static p-12 bg-card text-center">
            <div className="text-6xl mb-4">❤️</div>
            <h3 className="text-2xl font-heading font-bold text-foreground mb-2">No Appreciations Yet</h3>
            <p className="text-muted-foreground">
              Attendees haven't given any appreciations yet. Share the event link to get started!
            </p>
          </div>
        )
      ) : detailedScores ? (
        <ScoringDashboard scores={detailedScores} viewMode={viewMode} setViewMode={setViewMode} />
      ) : (
        <div className="card-static p-12 bg-card text-center">
          <div className="mb-4 flex justify-center">
            <BarChartIcon className="h-14 w-14 text-muted-foreground" />
          </div>
          <h3 className="text-2xl font-heading font-bold text-foreground mb-2">No Scores Yet</h3>
          <p className="text-muted-foreground mb-6">
            Judges haven't submitted any scores for this event yet.
          </p>
          <div className="max-w-md mx-auto text-left bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground">
            <p className="font-semibold mb-2 flex items-center gap-2">
              <LightbulbIcon className="h-4 w-4 text-amber-500" />
              To see demo scores:
            </p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Open your Convex dashboard</li>
              <li>Go to Functions → seed:seedJudgeScores</li>
              <li>Click "Run" to generate demo data</li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
