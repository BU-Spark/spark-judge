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

    const groups = [
        { title: "General Prizes", type: "general", items: prizesWithWinners.filter(p => p.prize.type === "general") },
        { title: "Track Prizes", type: "track", items: prizesWithWinners.filter(p => p.prize.type === "track") },
        { title: "Sponsor Prizes", type: "sponsor", items: prizesWithWinners.filter(p => p.prize.type === "sponsor") },
        { title: "Sponsor + Track Prizes", type: "track_sponsor", items: prizesWithWinners.filter(p => p.prize.type === "track_sponsor") },
    ].filter(g => g.items.length > 0);

    const assignedCount = prizesWithWinners.filter((p) => p.winningTeam).length;
    const isComplete = assignedCount === eventPrizes.length && eventPrizes.length > 0;

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
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

            <div className="space-y-10">
                {groups.map((group) => (
                    <div key={group.type} className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
                            {group.title}
                        </h3>
                        <div className="divide-y divide-border border border-border rounded-xl bg-card overflow-hidden">
                            {group.items.map(({ prize, winningTeam, notes }) => (
                                <div key={prize._id} className="flex flex-col md:flex-row md:items-center p-4 gap-4 hover:bg-muted/10 transition-colors">
                                    <div className="flex-1 min-w-[200px]">
                                        <h4 className="font-bold text-foreground">{prize.name}</h4>
                                        <p className="text-xs text-muted-foreground mt-0.5">
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
                                                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">Winner</span>
                                                    <span className="text-base font-bold text-foreground">{winningTeam.name}</span>
                                                </div>
                                                {notes && (
                                                    <p className="text-xs text-muted-foreground italic pl-3 border-l-2 border-border/50">
                                                        "{notes}"
                                                    </p>
                                                )}
                                            </>
                                        ) : (
                                            <span className="text-sm text-muted-foreground bg-muted/20 px-2 py-1 rounded border border-dashed border-border w-fit">
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
                    <div className="card-static py-12 text-center text-muted-foreground border-dashed">
                        No prizes are configured for this event.
                    </div>
                )}
            </div>
        </div>
    );
}
