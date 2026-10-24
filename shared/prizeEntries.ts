export type PrizeEntryMode = "automatic" | "opt_in";

export type EntryPrize = {
  _id: string;
  eventId: string;
  type: "general" | "track" | "sponsor" | "track_sponsor";
  track?: string;
  isActive?: boolean;
  entryMode?: PrizeEntryMode;
};
type EntryTeam = {
  _id: string;
  eventId: string;
  track?: string;
  hidden?: boolean;
};
type PrizeSubmission = { eventId: string; teamId: string; prizeId: string };
type AutomaticPrizeSubmission = PrizeSubmission & { automatic: true };

export function isPrizeEligibleForTrack(
  prize: Pick<EntryPrize, "type" | "track" | "isActive">,
  track?: string,
) {
  if (prize.isActive === false) return false;
  if (prize.type === "track" || prize.type === "track_sponsor") {
    return !!prize.track && prize.track === track;
  }
  return true;
}

/** Whether a prize type can enter teams automatically: every team for a
 * general prize, every team in the track for track prizes. Sponsor prizes are
 * always opt-in. */
export function supportsAutomaticEntry(type: EntryPrize["type"]) {
  return type !== "sponsor";
}

export function isAutomaticPrize(
  prize: Pick<EntryPrize, "type" | "entryMode">,
) {
  return prize.entryMode === "automatic" && supportsAutomaticEntry(prize.type);
}

/** Automatic entries are derived from the current track, so imports and track edits
 * use the same rule as participant submissions without requiring a second save. */
export function getEffectivePrizeSubmissions<S extends PrizeSubmission>(
  prizes: readonly EntryPrize[],
  teams: readonly EntryTeam[],
  selections: readonly S[],
): Array<S | AutomaticPrizeSubmission> {
  const prizesById = new Map(prizes.map((prize) => [prize._id, prize]));
  const teamsById = new Map(teams.map((team) => [team._id, team]));
  const entries = new Map<string, S | AutomaticPrizeSubmission>();
  for (const selection of selections) {
    const prize = prizesById.get(selection.prizeId);
    const team = teamsById.get(selection.teamId);
    if (
      !prize ||
      !team ||
      team.hidden ||
      team.eventId !== prize.eventId ||
      selection.eventId !== team.eventId ||
      !isPrizeEligibleForTrack(prize, team.track)
    )
      continue;
    // Automatic prizes are resolved below, even when a legacy explicit row exists.
    if (!isAutomaticPrize(prize))
      entries.set(`${prize._id}:${team._id}`, selection);
  }
  for (const prize of prizes) {
    if (!isAutomaticPrize(prize) || prize.isActive === false) continue;
    for (const team of teams) {
      if (
        team.hidden ||
        team.eventId !== prize.eventId ||
        !isPrizeEligibleForTrack(prize, team.track)
      )
        continue;
      entries.set(`${prize._id}:${team._id}`, {
        eventId: team.eventId,
        teamId: team._id,
        prizeId: prize._id,
        automatic: true,
      });
    }
  }
  return [...entries.values()];
}
