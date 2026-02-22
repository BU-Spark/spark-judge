import type { Id } from "../../../../convex/_generated/dataModel";

export function WinnersSummaryTab({
    eventPrizes,
    eventTeams,
    prizeWinners,
}: {
    eventPrizes?: any[];
    eventTeams: any[];
    prizeWinners?: any[];
}) {
    if (!eventPrizes || !prizeWinners) {
        return (
            <div className="card-static p-8 text-center bg-card border-dashed">
                <p className="text-muted-foreground">Winners have not been recorded yet.</p>
            </div>
        );
    }

    const teamMap = new Map<string, any>(
        eventTeams.map((t) => [String(t._id), t])
    );

    const prizesWithWinners = [...eventPrizes]
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((prize) => {
            const winnerRecord = prizeWinners.find((w) => String(w.prizeId) === String(prize._id));
            const winningTeam = winnerRecord ? teamMap.get(String(winnerRecord.teamId)) : null;
            return { prize, winningTeam, notes: winnerRecord?.notes };
        });

    const assignedCount = prizesWithWinners.filter((p) => p.winningTeam).length;
    const isComplete = assignedCount === eventPrizes.length && eventPrizes.length > 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between bg-card p-6 rounded-xl border border-border shadow-sm">
                <div>
                    <h2 className="text-2xl font-heading font-bold text-foreground flex items-center gap-3">
                        <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                        Prize Winners Summary
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        {assignedCount} of {eventPrizes.length} prizes awarded. {isComplete ? "All winners selected!" : ""}
                    </p>
                </div>
                {isComplete && (
                    <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium text-sm rounded-full border border-emerald-500/20">
                        Selections Complete
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {prizesWithWinners.map(({ prize, winningTeam, notes }) => (
                    <div key={prize._id} className="card-static flex flex-col p-5 bg-card">
                        <div className="flex items-start justify-between mb-4 gap-4">
                            <div>
                                <h3 className="text-lg font-bold font-heading text-foreground">{prize.name}</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {prize.type === "track" && prize.track ? `Track: ${prize.track}` : prize.type}
                                    {prize.sponsorName ? ` • ${prize.sponsorName}` : ""}
                                </p>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col justify-end">
                            {winningTeam ? (
                                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Winner</span>
                                    </div>
                                    <p className="text-lg font-semibold text-foreground break-words">{winningTeam.name}</p>

                                    {notes && (
                                        <div className="mt-3 pt-3 border-t border-border/50">
                                            <p className="text-xs text-muted-foreground italic">"{notes}"</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-muted/30 border border-dashed border-border rounded-lg p-4 text-center">
                                    <p className="text-sm text-muted-foreground">No winner selected yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {prizesWithWinners.length === 0 && (
                    <div className="col-span-full card-static py-12 text-center text-muted-foreground border-dashed">
                        No prizes are configured for this event.
                    </div>
                )}
            </div>
        </div>
    );
}
