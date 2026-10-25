import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import {
  isAutomaticPrize,
  isPrizeEligibleForTrack,
} from "../../../shared/prizeEntries";
import { scorecardTotal } from "../../../shared/judgingInsights";
import { validateCategoryScores } from "../../scores";

/** Additive, repeatable lifecycle fixtures for the named dev test event only. */
export async function seedTestLifecycleHandler(
  ctx: MutationCtx,
  {
    eventId,
    adminUserId,
    reopen = false,
  }: { eventId: Id<"events">; adminUserId: Id<"users">; reopen?: boolean },
) {
  // Internal functions run through deployment-admin tooling, outside a user
  // session. Validate the existing admin used to attribute fixture prizes.
  const admin = await ctx.db.get(adminUserId);
  if (!admin?.isAdmin)
    throw new Error("Choose an existing admin for fixture attribution");
  const event = await ctx.db.get(eventId);
  if (
    !event ||
    event.name !== "Test Hackathon (dev)" ||
    event.mode !== "hackathon"
  ) {
    throw new Error("Only Test Hackathon (dev) can receive these fixtures");
  }
  if (event.resultsReleased)
    throw new Error("Withdraw test results before adding fixtures");
  const tracks = event.tracks ?? [];
  if (tracks.length === 0 || event.categories.length === 0) {
    throw new Error("Configure test tracks and rubric first");
  }
  const now = Date.now();
  const teams = await ctx.db
    .query("teams")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .collect();
  const legacyTracks = ["Sustainability", "Health", "Civic Tech", "Open"];
  // The old fixture used these four track names despite copying DS+X's settings.
  for (const team of teams) {
    if (tracks.includes(team.track ?? "")) continue;
    const index = legacyTracks.indexOf(team.track ?? "");
    if (index < 0 || !tracks[index])
      throw new Error(`Review the test track for ${team.name}`);
  }
  let tracksUpdated = 0;
  for (const team of teams) {
    if (tracks.includes(team.track ?? "")) continue;
    team.track = tracks[legacyTracks.indexOf(team.track ?? "")];
    await ctx.db.patch(team._id, { track: team.track });
    tracksUpdated++;
  }
  await ctx.db.patch(eventId, {
    enableCohorts: false,
    ...(reopen
      ? {
          startDate: now - 3600_000,
          endDate: now + 24 * 3600_000,
          status: "active" as const,
          scoringLockedAt: undefined,
        }
      : {}),
  });

  const prizes = await ctx.db
    .query("prizes")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .collect();
  const catalog = [
    {
      name: "Top Overall",
      type: "general" as const,
      entryMode: "automatic" as const,
    },
    ...tracks.map((track) => ({
      name: `Best ${track} Project`,
      type: "track" as const,
      track,
      entryMode: "automatic" as const,
    })),
    {
      name: "Best First-Time Hacker",
      type: "general" as const,
      entryMode: "opt_in" as const,
    },
    {
      name: "Best Use of Lovable",
      type: "sponsor" as const,
      sponsorName: "Lovable",
      entryMode: "opt_in" as const,
    },
    {
      name: "Best Use of Figma",
      type: "sponsor" as const,
      sponsorName: "Figma",
      entryMode: "opt_in" as const,
    },
    {
      name: "Best Use of Library Resources",
      type: "sponsor" as const,
      sponsorName: "BU Libraries",
      entryMode: "opt_in" as const,
    },
    {
      name: "Libraries Health Award",
      type: "track_sponsor" as const,
      track: tracks[1] ?? tracks[0],
      sponsorName: "BU Libraries",
      entryMode: "opt_in" as const,
    },
  ];
  let prizesCreated = 0;
  for (const [i, prize] of catalog.entries()) {
    if (prizes.some((existing) => existing.name === prize.name)) continue;
    const value = {
      ...prize,
      eventId,
      isActive: true,
      scoreBasis: "overall" as const,
      sortOrder: prizes.length + i,
      createdBy: adminUserId,
      createdAt: now,
      updatedAt: now,
    };
    const prizeId = await ctx.db.insert("prizes", value);
    prizes.push({ _id: prizeId, _creationTime: now, ...value });
    prizesCreated++;
  }
  const entries = await ctx.db
    .query("teamPrizeSubmissions")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .collect();
  const existingEntries = new Set(
    entries.map((row) => `${row.prizeId}:${row.teamId}`),
  );
  let entriesCreated = 0;
  for (const [p, prize] of prizes.entries()) {
    if (prize.isActive === false || isAutomaticPrize(prize)) continue;
    const eligible = teams.filter(
      (team) => !team.hidden && isPrizeEligibleForTrack(prize, team.track),
    );
    for (const [i, team] of eligible.entries()) {
      if (i >= 3 && (i + p) % 3 !== 0) continue;
      const key = `${prize._id}:${team._id}`;
      if (existingEntries.has(key)) continue;
      await ctx.db.insert("teamPrizeSubmissions", {
        eventId,
        teamId: team._id,
        prizeId: prize._id,
        submittedAt: now,
      });
      existingEntries.add(key);
      entriesCreated++;
    }
  }

  const existingScores = await ctx.db
    .query("scores")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .collect();
  const scoreKeys = new Set(
    existingScores.map((row) => `${row.judgeId}:${row.teamId}`),
  );
  const judgeIds: Id<"judges">[] = [];
  let judgesCreated = 0;
  for (let i = 0; i < 6; i++) {
    const email = `lifecycle-judge-${i + 1}@hackjudge.example`;
    let user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), email))
      .first();
    if (!user) {
      const id = await ctx.db.insert("users", {
        name: `Test Judge ${i + 1}`,
        email,
        isAnonymous: false,
      });
      user = await ctx.db.get(id);
    }
    if (!user) throw new Error("Could not create fixture judge");
    let judge = await ctx.db
      .query("judges")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", user._id).eq("eventId", eventId),
      )
      .first();
    if (!judge) {
      const id = await ctx.db.insert("judges", {
        userId: user._id,
        eventId,
        judgeCodeVerifiedAt: now,
      });
      judge = await ctx.db.get(id);
      judgesCreated++;
    } else {
      await ctx.db.patch(judge._id, { judgeCodeVerifiedAt: now });
    }
    if (!judge) throw new Error("Could not register fixture judge");
    judgeIds.push(judge._id);
  }
  let scoresCreated = 0;
  for (const [i, team] of teams.filter((team) => !team.hidden).entries()) {
    for (let k = 0; k < 3; k++) {
      const j = (i + k) % judgeIds.length;
      const judgeId = judgeIds[j];
      const key = `${judgeId}:${team._id}`;
      if (scoreKeys.has(key)) continue;
      const categoryScores = validateCategoryScores(
        event.categories.map((category, c) => ({
          category: category.name,
          score: 2 + ((i * 7 + j * 3 + c) % 4),
        })),
        event.categories,
      );
      await ctx.db.insert("scores", {
        eventId,
        teamId: team._id,
        judgeId,
        categoryScores,
        totalScore: scorecardTotal(categoryScores, event.categories)!,
        submittedAt: now - (i + k) * 60_000,
      });
      scoreKeys.add(key);
      scoresCreated++;
    }
  }
  return {
    eventId,
    tracksUpdated,
    prizesCreated,
    entriesCreated,
    judgesCreated,
    scoresCreated,
    reopened: reopen,
  };
}
