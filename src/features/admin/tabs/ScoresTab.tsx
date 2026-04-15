import type { ReactNode } from "react";
import { WinnersSection } from "../sections/WinnersSection";
import { getEventMode } from "../../../lib/eventModes";
import {
  CODE_AND_TELL_RANK_HEADERS,
  CodeAndTellScoringExplainer,
} from "../codeAndTell/CodeAndTellScoringExplainer";

type CodeAndTellSummary = {
  totalBallots: number;
  rankedVoteRowCount?: number;
  maxBallots?: number | null;
  ballotsRemaining?: number | null;
  defaultWinnerId: string | null;
  selectedWinnerId: string | null;
  standings: Array<{
    teamId: string;
    name: string;
    description: string;
    projectUrl?: string;
    points: number;
    ballotsCount: number;
    rankCounts: number[];
  }>;
} | null;

export function ScoresTab({
  eventMode,
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
  codeAndTellSummary,
  viewMode,
  setViewMode,
  ScoringDashboard,
  MedalIcon,
  BarChartIcon,
  LightbulbIcon,
}: {
  eventMode?: "hackathon" | "demo_day" | "code_and_tell";
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
  codeAndTellSummary: CodeAndTellSummary;
  viewMode: "table" | "chart";
  setViewMode: (mode: "table" | "chart") => void;
  ScoringDashboard: (props: any) => ReactNode;
  MedalIcon: (props: any) => ReactNode;
  BarChartIcon: (props: any) => ReactNode;
  LightbulbIcon: (props: any) => ReactNode;
}) {
  const mode = getEventMode(eventMode);
  const isHackathon = mode === "hackathon";
  const isDemoDay = mode === "demo_day";
  const isCodeAndTell = mode === "code_and_tell";
  const canOpenWinners =
    isDemoDay ||
    (isCodeAndTell ? eventStatus === "past" : scoringLocked && hasConfiguredPrizes && prizeDeliberationReady);
  const canReleaseResults =
    !resultsReleased && (isDemoDay || isCodeAndTell ? eventStatus === "past" : scoringLocked);

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between p-4 mb-6 rounded-lg border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 mb-4 md:mb-0">
          <div
            className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
              resultsReleased
                ? "bg-slate-400"
                : isDemoDay
                  ? "bg-pink-500 animate-pulse"
                  : isCodeAndTell
                    ? "bg-amber-500 animate-pulse"
                    : !scoringLocked
                      ? "bg-teal-500 animate-pulse"
                      : "bg-amber-500"
            }`}
          />
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {resultsReleased
                ? "Event Complete"
                : isDemoDay
                  ? "Demo Day Active"
                  : isCodeAndTell
                    ? eventStatus === "past"
                      ? "Ready For Final Winner"
                      : "Balloting In Progress"
                    : scoringLocked
                      ? "Scoring Locked"
                      : "Judging in Progress"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {resultsReleased
                ? "Results have been released."
                : isDemoDay
                  ? "Review appreciations, select winners, and release results."
                  : isCodeAndTell
                    ? eventStatus === "past"
                      ? "Review Borda standings, choose the final winner, and release results."
                      : "Signed-in users can edit ranked ballots while the event is active."
                    : scoringLocked
                      ? hasConfiguredPrizes
                        ? "Run the winner wizard to assign prizes, then release results."
                        : "Add at least one prize in the Prizes tab to run the winner wizard."
                      : "Lock scoring before selecting winners or releasing results."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto">
          {eventStatus === "active" && (
            <button
              onClick={onFinishEvent}
              className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
            >
              Finish Event
            </button>
          )}

          {isHackathon && scoringLocked && (
            <button
              onClick={onToggleScoringLock}
              disabled={lockingScores}
              className="px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-md transition-colors disabled:opacity-50"
            >
              {lockingScores ? "Unlocking..." : "Unlock Scores"}
            </button>
          )}

          {isHackathon && !scoringLocked && (
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

          {canOpenWinners && !resultsReleased && (
            <button
              onClick={onOpenWinners}
              disabled={!canOpenWinners}
              className="px-4 py-1.5 text-sm font-medium border border-border bg-card text-foreground hover:bg-muted/50 rounded-md transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              {isDemoDay ? "Select Winners" : isCodeAndTell ? "Select Final Winner" : "Winner Wizard"}
            </button>
          )}

          {canReleaseResults && (
            <button
              onClick={onReleaseResults}
              disabled={!canReleaseResults}
              className="px-4 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Release Results
            </button>
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
      ) : isDemoDay ? (
        appreciationSummary ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm bg-muted/30 px-4 py-3 rounded-lg border border-border">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Total Appreciations:</span>
                <span className="font-semibold text-pink-500">{appreciationSummary.totalAppreciations}</span>
              </div>
              <div className="w-px h-4 bg-border hidden sm:block"></div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Unique Attendees:</span>
                <span className="font-semibold text-foreground">{appreciationSummary.uniqueAttendees}</span>
              </div>
              <div className="w-px h-4 bg-border hidden sm:block"></div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Projects:</span>
                <span className="font-semibold text-foreground">{appreciationSummary.teams.length}</span>
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
                {isGeneratingQr ? "Generating..." : "Download QR Codes"}
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
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-foreground">{team.teamName}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{team.courseCode || "-"}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{team.rawScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            icon="❤️"
            title="No Appreciations Yet"
            description="Attendees haven't given any appreciations yet. Share the event link to get started!"
          />
        )
      ) : isCodeAndTell ? (
        codeAndTellSummary && codeAndTellSummary.standings.length > 0 ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm bg-muted/30 px-4 py-3 rounded-lg border border-border">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Valid ballots (scoring):</span>
                <span className="font-semibold text-amber-500">{codeAndTellSummary.totalBallots}</span>
              </div>
              <div className="w-px h-4 bg-border hidden sm:block"></div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Visible projects:</span>
                <span className="font-semibold text-foreground">{codeAndTellSummary.standings.length}</span>
              </div>
              <div className="w-px h-4 bg-border hidden sm:block"></div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Winner status:</span>
                <span className="font-semibold text-foreground">
                  {codeAndTellSummary.selectedWinnerId
                    ? `Selected: ${codeAndTellSummary.standings.find((s) => s.teamId === codeAndTellSummary.selectedWinnerId)?.name || "Unknown"}`
                    : codeAndTellSummary.totalBallots > 0 && codeAndTellSummary.defaultWinnerId
                      ? `Leading: ${codeAndTellSummary.standings.find((s) => s.teamId === codeAndTellSummary.defaultWinnerId)?.name || "Unknown"}`
                      : "Pending"}
                </span>
              </div>
            </div>

            {typeof codeAndTellSummary.rankedVoteRowCount === "number" && (
              <p className="text-xs text-muted-foreground">
                Ballot records stored: {codeAndTellSummary.rankedVoteRowCount}
                {codeAndTellSummary.maxBallots != null
                  ? ` / cap ${codeAndTellSummary.maxBallots}${
                      codeAndTellSummary.ballotsRemaining != null
                        ? ` (${codeAndTellSummary.ballotsRemaining} slot${
                            codeAndTellSummary.ballotsRemaining === 1 ? "" : "s"
                          } left for new voters)`
                        : ""
                    }`
                  : ""}
                . Valid ballot count can differ if a row has no ranks counted toward scoring.
              </p>
            )}

            <div className="card-static p-6 bg-card">
              <div className="flex items-center gap-3 mb-4">
                <h4 className="text-xl font-heading font-bold text-foreground">Standings</h4>
                <CodeAndTellScoringExplainer />
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[48rem] w-full text-left text-sm">
                  <thead className="bg-muted/20 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">Rank</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">Project</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">Points</th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">Ballots</th>
                      {CODE_AND_TELL_RANK_HEADERS.map((label) => (
                        <th
                          key={label}
                          className="px-2 py-3 text-center text-xs font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {codeAndTellSummary.standings.map((row, index) => (
                      <tr key={row.teamId} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-sm font-bold text-foreground">#{index + 1}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-foreground">{row.name}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{row.points}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{row.ballotsCount}</td>
                        {CODE_AND_TELL_RANK_HEADERS.map((_, rankIndex) => (
                          <td
                            key={rankIndex}
                            className="px-2 py-3 text-center text-sm text-muted-foreground"
                          >
                            {row.rankCounts[rankIndex] ?? 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            icon="🏁"
            title="No Ballots Yet"
            description="Signed-in users have not submitted ranked ballots for this event yet."
          />
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

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="card-static p-12 bg-card text-center">
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-2xl font-heading font-bold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
