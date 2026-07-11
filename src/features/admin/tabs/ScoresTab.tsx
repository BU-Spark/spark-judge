import type { ReactNode } from "react";
import { WinnersSection } from "../sections/WinnersSection";
import { getEventMode } from "../../../lib/eventModes";
import {
  CODE_AND_TELL_RANK_HEADERS,
  CodeAndTellScoringExplainer,
} from "../codeAndTell/CodeAndTellScoringExplainer";
import { CODE_AND_TELL_MAX_RANKS } from "../../../lib/codeAndTellConstants";

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

type IntegritySummary =
  | {
      openFindings: number;
      flaggedAppreciations: number;
      rejectedAppreciations: number;
      findings: Array<{
        _id: any;
        type: string;
        severity: string;
        status: string;
        riskScore: number;
        reasons: string[];
        affectedCount: number;
        affectedTeamIds: string[];
        affectedAttendeeIds: string[];
        affectedTeams?: Array<{
          teamId: string;
          teamName: string;
          appreciationIds: any[];
          affectedVotes: number;
          projectedCleanScoreImpact: number;
        }>;
        summary: string;
        firstSeenAt: number;
        lastSeenAt: number;
        reviewNote?: string;
      }>;
    }
  | null
  | undefined;

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
  integritySummary,
  isScanningIntegrity,
  onRunIntegrityScan,
  onMarkIntegrityFindingReviewed,
  onRejectIntegrityFinding,
  onRestoreIntegrityFinding,
  onReviewIntegrityAppreciations,
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
  integritySummary: IntegritySummary;
  isScanningIntegrity: boolean;
  onRunIntegrityScan: () => void;
  onMarkIntegrityFindingReviewed: (findingId: any) => void;
  onRejectIntegrityFinding: (findingId: any) => void;
  onRestoreIntegrityFinding: (findingId: any) => void;
  onReviewIntegrityAppreciations: (
    appreciationIds: any[],
    reviewStatus: "accepted" | "flagged" | "rejected",
  ) => void;
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
    (isCodeAndTell
      ? eventStatus === "past"
      : scoringLocked && hasConfiguredPrizes && prizeDeliberationReady);
  const canReleaseResults =
    !resultsReleased &&
    (isDemoDay || isCodeAndTell ? eventStatus === "past" : scoringLocked);

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
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 11c1.105 0 2-.895 2-2V7a2 2 0 10-4 0v2c0 1.105.895 2 2 2zm-6 2a2 2 0 012-2h8a2 2 0 012 2v6H6v-6z"
                />
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
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                />
              </svg>
              {isDemoDay
                ? "Select Winners"
                : isCodeAndTell
                  ? "Select Final Winner"
                  : "Winner Wizard"}
            </button>
          )}

          {canReleaseResults && (
            <button
              onClick={onReleaseResults}
              disabled={!canReleaseResults}
              className="px-4 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Release Results
            </button>
          )}

          {resultsReleased && (
            <span className="px-4 py-1.5 text-sm font-medium border border-border bg-muted/30 text-muted-foreground rounded-md flex items-center gap-2">
              <svg
                className="w-4 h-4 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Results Released
            </span>
          )}
        </div>
      </div>

      {isPageLayout && scoresView === "winners" ? (
        <WinnersSection>{winnersContent}</WinnersSection>
      ) : isDemoDay ? (
        appreciationSummary ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm bg-muted/30 px-4 py-3 rounded-lg border border-border">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  Total Appreciations:
                </span>
                <span className="font-semibold text-pink-500">
                  {appreciationSummary.totalAppreciations}
                </span>
              </div>
              <div className="w-px h-4 bg-border hidden sm:block"></div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Clean Count:</span>
                <span className="font-semibold text-foreground">
                  {appreciationSummary.cleanAppreciations ??
                    appreciationSummary.totalAppreciations}
                </span>
              </div>
              <div className="w-px h-4 bg-border hidden sm:block"></div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Unique Attendees:</span>
                <span className="font-semibold text-foreground">
                  {appreciationSummary.uniqueAttendees}
                </span>
              </div>
              <div className="w-px h-4 bg-border hidden sm:block"></div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Projects:</span>
                <span className="font-semibold text-foreground">
                  {appreciationSummary.teams.length}
                </span>
              </div>
            </div>

            <ScoringBasisPanel
              title="Scoring basis"
              description="Demo Day rankings use attendee appreciations. Each heart has equal weight, with per-attendee and per-project caps controlling distribution."
              items={[
                {
                  label: "Attendee budget",
                  value: `${appreciationSummary.appreciationBudgetPerAttendee ?? 100} hearts`,
                },
                {
                  label: "Per-project cap",
                  value: `${appreciationSummary.appreciationMaxPerTeam ?? 10} hearts`,
                },
                { label: "Ranking field", value: "Clean appreciations" },
              ]}
            />

            <DemoDayIntegrityPanel
              integritySummary={integritySummary}
              isScanning={isScanningIntegrity}
              onRunScan={onRunIntegrityScan}
              onMarkReviewed={onMarkIntegrityFindingReviewed}
              onReject={onRejectIntegrityFinding}
              onRestore={onRestoreIntegrityFinding}
              onReviewAppreciations={onReviewIntegrityAppreciations}
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={onExportAppreciationsCsv}
                className="btn-secondary flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
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
              <h4 className="text-xl font-heading font-bold text-foreground mb-4">
                Project Rankings
              </h4>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="bg-muted/20 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                        Rank
                      </th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                        Project
                      </th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                        Course
                      </th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                        Clean
                      </th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                        Raw
                      </th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                        Review
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {appreciationSummary.teams.map(
                      (team: any, index: number) => (
                        <tr
                          key={team.teamId}
                          className="hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-4 py-3 text-sm font-bold text-foreground">
                            <span className="flex items-center gap-2">
                              #{index + 1}
                              {index === 0 && (
                                <MedalIcon className="h-5 w-5 text-amber-500" />
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-foreground">
                            {team.teamName}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {team.courseCode || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground">
                            {team.cleanScore}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {team.rawScore}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {team.flagged ? (
                              <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                                Flagged
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      ),
                    )}
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
                <span className="text-muted-foreground">
                  Valid ballots (scoring):
                </span>
                <span className="font-semibold text-amber-500">
                  {codeAndTellSummary.totalBallots}
                </span>
              </div>
              <div className="w-px h-4 bg-border hidden sm:block"></div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Visible projects:</span>
                <span className="font-semibold text-foreground">
                  {codeAndTellSummary.standings.length}
                </span>
              </div>
              <div className="w-px h-4 bg-border hidden sm:block"></div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Winner status:</span>
                <span className="font-semibold text-foreground">
                  {codeAndTellSummary.selectedWinnerId
                    ? `Selected: ${codeAndTellSummary.standings.find((s) => s.teamId === codeAndTellSummary.selectedWinnerId)?.name || "Unknown"}`
                    : codeAndTellSummary.totalBallots > 0 &&
                        codeAndTellSummary.defaultWinnerId
                      ? `Leading: ${codeAndTellSummary.standings.find((s) => s.teamId === codeAndTellSummary.defaultWinnerId)?.name || "Unknown"}`
                      : "Pending"}
                </span>
              </div>
            </div>

            <ScoringBasisPanel
              title="Scoring basis"
              description="Code & Tell uses Borda-style ranked voting. Higher ranks contribute more points, and rank counts are shown for tie review."
              items={CODE_AND_TELL_RANK_HEADERS.map((label, index) => ({
                label,
                value: `${CODE_AND_TELL_MAX_RANKS - index} pts`,
              }))}
            />

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
                . Valid ballot count can differ if a row has no ranks counted
                toward scoring.
              </p>
            )}

            <div className="card-static p-6 bg-card">
              <div className="flex items-center gap-3 mb-4">
                <h4 className="text-xl font-heading font-bold text-foreground">
                  Standings
                </h4>
                <CodeAndTellScoringExplainer />
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[48rem] w-full text-left text-sm">
                  <thead className="bg-muted/20 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                        Rank
                      </th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                        Project
                      </th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                        Points
                      </th>
                      <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                        Ballots
                      </th>
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
                      <tr
                        key={row.teamId}
                        className="hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm font-bold text-foreground">
                          #{index + 1}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-foreground">
                          {row.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {row.points}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {row.ballotsCount}
                        </td>
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
        <ScoringDashboard
          scores={detailedScores}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
      ) : (
        <div className="card-static p-12 bg-card text-center">
          <div className="mb-4 flex justify-center">
            <BarChartIcon className="h-14 w-14 text-muted-foreground" />
          </div>
          <h3 className="text-2xl font-heading font-bold text-foreground mb-2">
            No Scores Yet
          </h3>
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

function DemoDayIntegrityPanel({
  integritySummary,
  isScanning,
  onRunScan,
  onMarkReviewed,
  onReject,
  onRestore,
  onReviewAppreciations,
}: {
  integritySummary: IntegritySummary;
  isScanning: boolean;
  onRunScan: () => void;
  onMarkReviewed: (findingId: any) => void;
  onReject: (findingId: any) => void;
  onRestore: (findingId: any) => void;
  onReviewAppreciations: (
    appreciationIds: any[],
    reviewStatus: "accepted" | "flagged" | "rejected",
  ) => void;
}) {
  const findings = integritySummary?.findings ?? [];
  const openFindings = integritySummary?.openFindings ?? 0;
  const flagged = integritySummary?.flaggedAppreciations ?? 0;
  const rejected = integritySummary?.rejectedAppreciations ?? 0;

  return (
    <div className="card-static bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-border">
        <div>
          <h4 className="text-lg font-heading font-bold text-foreground">
            Integrity Review
          </h4>
          <p className="text-sm text-muted-foreground">
            Scanner findings are suggestions. Flagged votes keep counting until
            an admin rejects them.
          </p>
        </div>
        <button
          type="button"
          onClick={onRunScan}
          disabled={isScanning}
          className="btn-secondary whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isScanning ? "Scanning..." : "Run Scan"}
        </button>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-muted/20">
        <IntegrityMetric label="Open" value={openFindings} tone="amber" />
        <IntegrityMetric label="Flagged votes" value={flagged} tone="amber" />
        <IntegrityMetric label="Rejected votes" value={rejected} tone="rose" />
      </div>

      {integritySummary === undefined ? (
        <div className="px-5 py-4 text-sm text-muted-foreground">
          Loading integrity findings...
        </div>
      ) : findings.length === 0 ? (
        <div className="px-5 py-4 text-sm text-muted-foreground">
          No integrity findings yet.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {findings.slice(0, 8).map((finding) => (
            <div key={String(finding._id)} className="px-5 py-4 space-y-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        finding.status === "open"
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          : finding.status === "rejected"
                            ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {finding.status}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">
                      {finding.type.replaceAll("_", " ")} · risk{" "}
                      {finding.riskScore}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {finding.summary}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {finding.affectedCount} vote
                    {finding.affectedCount === 1 ? "" : "s"} ·{" "}
                    {finding.affectedTeamIds.length} project
                    {finding.affectedTeamIds.length === 1 ? "" : "s"} ·{" "}
                    {finding.affectedAttendeeIds.length} attendee ID
                    {finding.affectedAttendeeIds.length === 1 ? "" : "s"}
                  </p>
                  {(finding.affectedTeams?.length ?? 0) > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Affected:{" "}
                      {finding.affectedTeams
                        ?.slice(0, 3)
                        .map((team) => team.teamName)
                        .join(", ")}
                      {(finding.affectedTeams?.length ?? 0) > 3
                        ? ` +${(finding.affectedTeams?.length ?? 0) - 3} more`
                        : ""}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {finding.status === "open" && (
                    <button
                      type="button"
                      onClick={() => onMarkReviewed(finding._id)}
                      className="btn-secondary text-xs"
                    >
                      Mark reviewed
                    </button>
                  )}
                  {finding.status !== "rejected" ? (
                    <button
                      type="button"
                      onClick={() => onReject(finding._id)}
                      className="text-xs font-medium px-3 py-2 rounded-lg border border-rose-500/30 text-rose-600 hover:bg-rose-500/10 transition-colors"
                    >
                      Reject votes
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onRestore(finding._id)}
                      className="text-xs font-medium px-3 py-2 rounded-lg border border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 transition-colors"
                    >
                      Restore votes
                    </button>
                  )}
                </div>
              </div>
              {finding.reasons.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {finding.reasons.slice(0, 5).map((reason) => (
                    <span
                      key={reason}
                      className="rounded-md bg-muted px-2 py-1 text-[11px] font-mono text-muted-foreground"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              )}
              {(finding.affectedTeams?.length ?? 0) > 0 && (
                <div className="rounded-lg border border-border bg-muted/20">
                  {finding.affectedTeams?.slice(0, 5).map((team) => (
                    <div
                      key={team.teamId}
                      className="flex flex-col gap-2 border-b border-border px-3 py-2 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {team.teamName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {team.affectedVotes} affected vote
                          {team.affectedVotes === 1 ? "" : "s"} · projected
                          clean impact -{team.projectedCleanScoreImpact}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {team.projectedCleanScoreImpact > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              onReviewAppreciations(
                                team.appreciationIds,
                                "rejected",
                              )
                            }
                            className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-rose-500/30 text-rose-600 hover:bg-rose-500/10 transition-colors"
                          >
                            Reject selected
                          </button>
                        )}
                        {team.projectedCleanScoreImpact === 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              onReviewAppreciations(
                                team.appreciationIds,
                                "flagged",
                              )
                            }
                            className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 transition-colors"
                          >
                            Restore selected
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IntegrityMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "rose";
}) {
  return (
    <div className="px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-mono text-lg font-bold ${
          tone === "rose"
            ? "text-rose-600 dark:text-rose-400"
            : "text-amber-600 dark:text-amber-400"
        }`}
      >
        {value}
      </p>
    </div>
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
      <h3 className="text-2xl font-heading font-bold text-foreground mb-2">
        {title}
      </h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

function ScoringBasisPanel({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => (
          <div
            key={`${item.label}-${item.value}`}
            className="rounded-md border border-border bg-background px-3 py-2"
          >
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-1 font-mono text-sm font-semibold text-foreground">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
