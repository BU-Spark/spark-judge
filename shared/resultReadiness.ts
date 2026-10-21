export type ResultsMode = "hackathon" | "demo_day" | "code_and_tell";

export type ResultTeam = { _id: string; name: string; hidden?: boolean };
export type ResultPrize = {
  _id: string;
  name: string;
  sortOrder?: number;
  isActive?: boolean;
};
export type ResultWinner = { prizeId: string; teamId: string; notes?: string };
export type ResultsInput = {
  mode?: ResultsMode;
  status: "upcoming" | "active" | "past";
  scoringLocked: boolean;
  teams: ResultTeam[];
  prizes: ResultPrize[];
  prizeWinners: ResultWinner[];
  overallWinnerId?: string | null;
  categories: string[];
  categoryWinners: Array<{ category: string; teamId: string }>;
  eligibleEntries?: Array<{ prizeId: string; teamId: string }>;
};

export function getResultReadiness(input: ResultsInput) {
  const mode = input.mode ?? "hackathon";
  const visibleTeams = new Map(
    input.teams
      .filter((team) => !team.hidden)
      .map((team) => [String(team._id), team]),
  );
  const blockers: string[] = [];
  if (input.status !== "past")
    blockers.push("Finish the event before publishing.");
  if (mode === "hackathon" && !input.scoringLocked)
    blockers.push("Lock scoring before choosing and publishing winners.");

  const awards =
    mode === "hackathon"
      ? input.prizes
          .filter((prize) => prize.isActive !== false)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          .map((prize) => {
            const winner = input.prizeWinners.find(
              (row) => String(row.prizeId) === String(prize._id),
            );
            return {
              id: String(prize._id),
              name: prize.name,
              team: winner
                ? visibleTeams.get(String(winner.teamId))
                : undefined,
              required: true,
            };
          })
      : [
          {
            id: "overall",
            name: mode === "code_and_tell" ? "Final winner" : "Overall winner",
            team: input.overallWinnerId
              ? visibleTeams.get(String(input.overallWinnerId))
              : undefined,
            required: true,
          },
          ...(mode === "demo_day"
            ? input.categories.map((category) => {
                const winner = input.categoryWinners.find(
                  (row) => row.category === category,
                );
                return {
                  id: category,
                  name: category,
                  team: winner
                    ? visibleTeams.get(String(winner.teamId))
                    : undefined,
                  required: false,
                };
              })
            : []),
        ];

  if (mode === "hackathon" && awards.length === 0)
    blockers.push("Configure at least one prize.");
  if (mode === "hackathon" && input.eligibleEntries) {
    const entries = new Set(
      input.eligibleEntries.map((entry) => `${entry.prizeId}:${entry.teamId}`),
    );
    if (
      input.prizeWinners.some(
        (winner) => !entries.has(`${winner.prizeId}:${winner.teamId}`),
      )
    )
      blockers.push(
        "A selected winner is no longer entered for its prize. Review winner selections.",
      );
  }
  const missing = awards.filter((award) => award.required && !award.team);
  if (missing.length)
    blockers.push(
      mode === "hackathon"
        ? `Choose a valid winner for ${missing.length} remaining prize${missing.length === 1 ? "" : "s"}.`
        : "Choose a visible project as the overall winner.",
    );
  if (
    mode === "demo_day" &&
    input.categoryWinners.some(
      (winner) =>
        !input.categories.includes(winner.category) ||
        !visibleTeams.has(String(winner.teamId)),
    )
  )
    blockers.push("Update unavailable category winners before publishing.");

  return {
    awards,
    blockers,
    ready: blockers.length === 0,
    selectedCount: awards.filter((award) => award.team).length,
    optionalUnassigned: awards.filter(
      (award) => !award.required && !award.team,
    ),
  };
}
