import type { MutationCtx } from "../../_generated/server";
import { TEAMS } from "./seedLiveHackathon";

export const TUTORIAL_NAME = "Judge Tutorial (admin only)";

/** A separate, private rehearsal. Never changes real event data or scores. */
export async function seedJudgeTutorialHandler(ctx: MutationCtx) {
  const existing = await ctx.db.query("events")
    .filter((q) => q.eq(q.field("name"), TUTORIAL_NAME)).first();
  if (existing) {
    if (!existing.hidden || existing.mode !== "hackathon") {
      throw new Error("Review the existing tutorial before changing it");
    }
    return { eventId: existing._id, created: false };
  }
  const template = await ctx.db.query("events")
    .filter((q) => q.eq(q.field("name"), "DS+X 2026")).first();
  const admin = await ctx.db.query("users")
    .filter((q) => q.eq(q.field("isAdmin"), true)).first();
  if (!admin) throw new Error("An existing platform admin is required");
  const now = Date.now();
  const tracks = template?.tracks?.length ? template.tracks : ["Art & Design", "Health & BioTech", "College Hack", "Open Hack"];
  const eventId = await ctx.db.insert("events", {
    name: TUTORIAL_NAME,
    description: "Practice choosing projects, scoring, reviewing, and submitting a ballot. All teams are fictional. Only platform admins can access this tutorial.",
    hidden: true,
    mode: "hackathon",
    startDate: now - 3600_000,
    endDate: now + 30 * 24 * 3600_000,
    status: "active",
    categories: template?.categories ?? [
      { name: "Impact", weight: 1 },
      { name: "Technical Execution", weight: 1 },
      { name: "Design", weight: 1 },
    ],
    tracks,
    judgeCode: "JUDGE-TUTORIAL",
    enableCohorts: false,
    resultsReleased: false,
  });
  const teamIds = [];
  for (const [i, team] of TEAMS.entries()) {
    teamIds.push(await ctx.db.insert("teams", {
      ...team, eventId, track: tracks[i % tracks.length], submittedAt: now,
      members: [`Demo Member ${i + 1}A`, `Demo Member ${i + 1}B`],
    }));
  }
  for (const [i, prize] of [
    { name: "Tutorial Overall Award", type: "general" as const, entryMode: "automatic" as const },
    { name: "Tutorial Design Award", type: "sponsor" as const, sponsorName: "Demo Sponsor", entryMode: "opt_in" as const },
  ].entries()) {
    const prizeId = await ctx.db.insert("prizes", {
      ...prize, eventId, isActive: true, scoreBasis: "overall", sortOrder: i,
      createdBy: admin._id, createdAt: now, updatedAt: now,
    });
    if (prize.entryMode === "opt_in") {
      for (const teamId of teamIds.slice(0, 5)) {
        await ctx.db.insert("teamPrizeSubmissions", { eventId, teamId, prizeId, submittedAt: now });
      }
    }
  }
  return { eventId, created: true };
}
