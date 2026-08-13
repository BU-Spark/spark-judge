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
  standings: Array<{
    teamId: string;
    name: string;
    description: string;
    points: number;
    ballotsCount: number;
    rankCounts: number[];
  }>;
};

export function WinnersSummaryTab({
  eventMode,
  eventPrizes,
  eventTeams,
  prizeWinners,
  overallWinnerId,
  categoryWinners,
  codeAndTellSummary,
}: {
  eventMode?: "hackathon" | "demo_day" | "code_and_tell";
  eventPrizes?: any[];
  eventTeams: any[];
  prizeWinners?: any[];
  overallWinnerId?: string | null;
  categoryWinners?: Array<{ category: string; teamId: string }>;
  codeAndTellSummary?: CodeAndTellSummary | null;
}) {
  const mode = getEventMode(eventMode);
  const teamMap = new Map<string, any>(eventTeams.map((team) => [String(team._id), team]));

  if (mode === "code_and_tell") {
    const winningTeam = overallWinnerId ? teamMap.get(String(overallWinnerId)) : null;
    const standings = codeAndTellSummary?.standings || [];

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between fi-surface p-6 rounded-xl border border-border shadow-sm">
          <div>
            <h2 className="text-2xl fi-zone font-bold fi-ink flex items-center gap-3">
              <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Code &amp; Tell Results
            </h2>
            <p className="text-sm fi-muted mt-1">
              {codeAndTellSummary?.totalBallots || 0} valid ballot
              {(codeAndTellSummary?.totalBallots || 0) === 1 ? "" : "s"} in the
              score tally
              {typeof codeAndTellSummary?.rankedVoteRowCount === "number"
                ? ` · ${codeAndTellSummary.rankedVoteRowCount} voter record${
                    codeAndTellSummary.rankedVoteRowCount === 1 ? "" : "s"
                  }`
                : ""}
              .
            </p>
          </div>
          {winningTeam ? (
            <span className="px-4 py-1.5 bg-amber-500/10 text-amber-600  font-medium text-sm rounded-full border border-amber-500/20">
              Winner selected
            </span>
          ) : (
            <span className="px-4 py-1.5 bg-muted fi-muted font-medium text-sm rounded-full border border-border">
              Winner pending
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(18rem,24rem)_1fr]">
          <div className="fi-panel p-6 fi-surface border border-border">
            <h3 className="text-sm font-bold uppercase tracking-wider fi-muted mb-2">
              Final Winner
            </h3>
            {winningTeam ? (
              <>
                <div className="text-2xl fi-zone font-bold fi-ink">
                  {winningTeam.name}
                </div>
                <p className="mt-2 text-sm fi-muted">
                  {winningTeam.description || "No description"}
                </p>
              </>
            ) : (
              <p className="text-sm fi-muted">
                No winner selected yet.
              </p>
            )}
          </div>

          <div className="fi-panel p-6 fi-surface border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider fi-muted">
                Top Standings
              </h3>
              <CodeAndTellScoringExplainer />
            </div>
            {standings.length === 0 ? (
              <p className="text-sm fi-muted">
                No valid ballots have been submitted yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[44rem] w-full text-left text-sm">
                  <thead className="bg-muted/20 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-xs font-bold fi-muted uppercase tracking-wide">Rank</th>
                      <th className="px-4 py-3 text-xs font-bold fi-muted uppercase tracking-wide">Project</th>
                      <th className="px-4 py-3 text-xs font-bold fi-muted uppercase tracking-wide">Points</th>
                      <th className="px-4 py-3 text-xs font-bold fi-muted uppercase tracking-wide">Ballots</th>
                      {CODE_AND_TELL_RANK_HEADERS.map((label) => (
                        <th
                          key={label}
                          className="px-2 py-3 text-center text-xs font-bold fi-muted uppercase tracking-wide whitespace-nowrap"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {standings.slice(0, 5).map((row, index) => (
                      <tr key={row.teamId} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-sm font-bold fi-ink">#{index + 1}</td>
                        <td className="px-4 py-3 text-sm font-semibold fi-ink">{row.name}</td>
                        <td className="px-4 py-3 text-sm fi-ink">{row.points}</td>
                        <td className="px-4 py-3 text-sm fi-muted">{row.ballotsCount}</td>
                        {CODE_AND_TELL_RANK_HEADERS.map((_, rankIndex) => (
                          <td
                            key={rankIndex}
                            className="px-2 py-3 text-center text-sm fi-muted"
                          >
                            {row.rankCounts[rankIndex] ?? 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (mode === "demo_day") {
    const winningTeam = overallWinnerId ? teamMap.get(String(overallWinnerId)) : null;

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="fi-panel p-6 fi-surface border border-border">
          <h2 className="text-2xl fi-zone font-bold fi-ink">Demo Day Winners</h2>
          <p className="mt-1 text-sm fi-muted">
            {winningTeam ? "Winner selections are saved for this event." : "Winners have not been recorded yet."}
          </p>
        </div>

        {winningTeam ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(18rem,24rem)_1fr]">
            <div className="fi-panel p-6 fi-surface border border-border">
              <h3 className="text-sm font-bold uppercase tracking-wider fi-muted mb-2">
                Overall Winner
              </h3>
              <div className="text-2xl fi-zone font-bold fi-ink">
                {winningTeam.name}
              </div>
            </div>
            <div className="fi-panel p-6 fi-surface border border-border">
              <h3 className="text-sm font-bold uppercase tracking-wider fi-muted mb-4">
                Category Winners
              </h3>
              {categoryWinners && categoryWinners.length > 0 ? (
                <div className="space-y-3">
                  {categoryWinners.map((winner) => (
                    <div key={winner.category} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                      <span className="text-sm font-medium fi-muted">
                        {winner.category}
                      </span>
                      <span className="text-sm font-semibold fi-ink">
                        {teamMap.get(String(winner.teamId))?.name || "Unknown"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm fi-muted">
                  No category winners selected yet.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (!eventPrizes || !prizeWinners) {
    return (
      <div className="fi-panel p-8 text-center fi-surface border-dashed">
        <p className="fi-muted">Winners have not been recorded yet.</p>
      </div>
    );
  }

  const prizesWithWinners = [...eventPrizes]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((prize) => {
      const winnerRecord = prizeWinners.find((winner) => String(winner.prizeId) === String(prize._id));
      const winningTeam = winnerRecord ? teamMap.get(String(winnerRecord.teamId)) : null;
      return { prize, winningTeam, notes: winnerRecord?.notes };
    });

  const groups = [
    { title: "General Prizes", type: "general", items: prizesWithWinners.filter((item) => item.prize.type === "general") },
    { title: "Track Prizes", type: "track", items: prizesWithWinners.filter((item) => item.prize.type === "track") },
    { title: "Sponsor Prizes", type: "sponsor", items: prizesWithWinners.filter((item) => item.prize.type === "sponsor") },
    { title: "Sponsor + Track Prizes", type: "track_sponsor", items: prizesWithWinners.filter((item) => item.prize.type === "track_sponsor") },
  ].filter((group) => group.items.length > 0);

  const assignedCount = prizesWithWinners.filter((item) => item.winningTeam).length;
  const isComplete = assignedCount === eventPrizes.length && eventPrizes.length > 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between fi-surface p-6 rounded-xl border border-border shadow-sm">
        <div>
          <h2 className="text-2xl fi-zone font-bold fi-ink flex items-center gap-3">
            <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            Prize Winners Summary
          </h2>
          <p className="text-sm fi-muted mt-1">
            {assignedCount} of {eventPrizes.length} prizes awarded. {isComplete ? "All winners selected!" : ""}
          </p>
        </div>
        {isComplete && (
          <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-600  font-medium text-sm rounded-full border border-emerald-500/20">
            Selections Complete
          </span>
        )}
      </div>

      <div className="space-y-10">
        {groups.map((group) => (
          <div key={group.type} className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider fi-muted border-b border-border pb-2">
              {group.title}
            </h3>
            <div className="divide-y divide-border border border-border rounded-xl fi-surface overflow-hidden">
              {group.items.map(({ prize, winningTeam, notes }) => (
                <div key={prize._id} className="flex flex-col md:flex-row md:items-center p-4 gap-4 hover:bg-muted/10 transition-colors">
                  <div className="flex-1 min-w-[200px]">
                    <h4 className="font-bold fi-ink">{prize.name}</h4>
                    <p className="text-xs fi-muted mt-0.5">
                      {prize.type === "track" && prize.track ? `Track: ${prize.track}` :
                        prize.type === "sponsor" ? `Sponsor: ${prize.sponsorName}` :
                          prize.type === "track_sponsor" ? `${prize.sponsorName} • ${prize.track}` :
                            "General Prize"}
                    </p>
                  </div>

                  <div className="flex-[1.5] flex flex-col gap-1">
                    {winningTeam ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-emerald-600  bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">Winner</span>
                          <span className="text-base font-bold fi-ink">{winningTeam.name}</span>
                        </div>
                        {notes && (
                          <p className="text-xs fi-muted italic pl-3 border-l-2 border-border/50">
                            "{notes}"
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-sm fi-muted bg-muted/20 px-2 py-1 rounded border border-dashed border-border w-fit">
                        No winner selected yet
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {prizesWithWinners.length === 0 && (
          <div className="fi-panel py-12 text-center fi-muted border-dashed">
            No prizes are configured for this event.
          </div>
        )}
      </div>
    </div>
  );
}
