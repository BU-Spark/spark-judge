import { MutationCtx } from "../../_generated/server";
import { TEAMS } from "./seedLiveHackathon";

/**
 * Creates a visible hackathon that is live right now, for testing the
 * homepage and judging flow without moving a real event's dates. It copies
 * DS+X 2026's rubric and tracks when that event exists. Running it again
 * re-centers the window on the current time; teams are only inserted once.
 */

const NAME = "Test Hackathon (dev)";
const JUDGE_CODE = "TEST-JUDGE";
const HOUR = 3600_000;

export async function seedTestLiveHackathonHandler(
  ctx: MutationCtx,
  { hours = 8 }: { hours?: number },
) {
  const now = Date.now();
  const window = { startDate: now - HOUR, endDate: now + hours * HOUR, status: "active" as const };

  const template = await ctx.db
    .query("events")
    .filter((q) => q.eq(q.field("name"), "DS+X 2026"))
    .first();
  const existing = await ctx.db
    .query("events")
    .filter((q) => q.eq(q.field("name"), NAME))
    .first();

  let eventId;
  if (existing) {
    eventId = existing._id;
    await ctx.db.patch(eventId, window);
  } else {
    eventId = await ctx.db.insert("events", {
      name: NAME,
      description: "A live test event on the dev backend. Safe to judge, lock, and delete.",
      ...window,
      categories: template?.categories ?? [
        { name: "Impact", weight: 1 },
        { name: "Technical Execution", weight: 1 },
        { name: "Design", weight: 1 },
      ],
      tracks: template?.tracks ?? [...new Set(TEAMS.map((team) => team.track))],
      mode: "hackathon",
      judgeCode: JUDGE_CODE,
      resultsReleased: false,
    });
  }

  const existingTeams = await ctx.db
    .query("teams")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .collect();
  let teamsCreated = 0;
  if (existingTeams.length === 0) {
    for (const team of TEAMS) {
      await ctx.db.insert("teams", {
        eventId,
        name: team.name,
        description: team.description,
        members: team.members,
        track: team.track,
        submittedAt: now - HOUR,
      });
      teamsCreated++;
    }
  }

  const event = await ctx.db.get(eventId);
  return {
    message: `${NAME} is live until ${new Date(window.endDate).toISOString()} with ${existingTeams.length + teamsCreated} teams.`,
    eventId,
    teamsCreated,
    judgeCode: event?.judgeCode ?? null,
  };
}
