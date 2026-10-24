import { MutationCtx } from "../../_generated/server";
import { TEAMS } from "./seedLiveHackathon";

/**
 * Creates a visible hackathon that is live right now, for testing the
 * homepage and judging flow without moving a real event's dates. It copies
 * DS+X 2026's rubric and tracks when that event exists. Running it again
 * re-centers the window on the current time and tops the roster up to
 * TEAM_COUNT. Cohorts are on, so each judge builds a queue from far more
 * teams than they could score.
 */

const NAME = "Test Hackathon (dev)";
const JUDGE_CODE = "TEST-JUDGE";
const HOUR = 3600_000;
const TEAM_COUNT = 60;

const PREFIXES = ["Civic", "Green", "Care", "Data", "Open", "Safe", "Fair", "Clear", "Quick", "Bright"];
const SUFFIXES = ["Map", "Pulse", "Link", "Lens", "Path", "Loop"];

/** The hand-written teams, then generated filler up to TEAM_COUNT. */
function roster() {
  const tracks = [...new Set(TEAMS.map((team) => team.track))];
  const names = new Set(TEAMS.map((team) => team.name));
  const teams = [...TEAMS];
  for (const prefix of PREFIXES) {
    for (const suffix of SUFFIXES) {
      if (teams.length >= TEAM_COUNT) return teams;
      const name = prefix + suffix;
      if (names.has(name)) continue;
      const i = teams.length;
      teams.push({
        name,
        description: `${name} is a generated test project for queue and cohort judging.`,
        track: tracks[i % tracks.length],
        members: [`Member ${i}A`, `Member ${i}B`],
      });
    }
  }
  return teams;
}

export async function seedTestLiveHackathonHandler(
  ctx: MutationCtx,
  { hours = 8 }: { hours?: number },
) {
  const now = Date.now();
  const window = { startDate: now - HOUR, endDate: now + hours * HOUR, status: "active" as const, enableCohorts: true };

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
  const existingNames = new Set(existingTeams.map((team) => team.name));
  let teamsCreated = 0;
  for (const team of roster()) {
    if (existingNames.has(team.name)) continue;
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

  const event = await ctx.db.get(eventId);
  return {
    message: `${NAME} is live until ${new Date(window.endDate).toISOString()} with ${existingTeams.length + teamsCreated} teams.`,
    eventId,
    teamsCreated,
    judgeCode: event?.judgeCode ?? null,
  };
}
