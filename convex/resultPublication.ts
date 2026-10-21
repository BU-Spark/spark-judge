import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { computeEventStatus } from "./helpers";
import { getResultReadiness } from "../shared/resultReadiness";
import { getEffectivePrizeSubmissions } from "../shared/prizeEntries";

export async function assertResultsReady(
  ctx: MutationCtx,
  event: Doc<"events">,
) {
  const [teams, prizes, prizeWinners, submissions] = await Promise.all([
    ctx.db
      .query("teams")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .collect(),
    ctx.db
      .query("prizes")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .collect(),
    ctx.db
      .query("prizeWinners")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .collect(),
    ctx.db
      .query("teamPrizeSubmissions")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .collect(),
  ]);
  const eligibleEntries = getEffectivePrizeSubmissions(
    prizes,
    teams,
    submissions,
  );
  const readiness = getResultReadiness({
    mode: event.mode,
    status: computeEventStatus(event),
    scoringLocked: !!event.scoringLockedAt,
    teams,
    prizes,
    prizeWinners,
    overallWinnerId: event.overallWinner,
    categories: event.categories.map((category) => category.name),
    categoryWinners: event.categoryWinners ?? [],
    eligibleEntries,
  });
  if (!readiness.ready) throw new Error(readiness.blockers.join(" "));
}
