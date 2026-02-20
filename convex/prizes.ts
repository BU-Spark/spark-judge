import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { computeEventStatus, isAdmin, requireAdmin } from "./helpers";
import { Doc, Id } from "./_generated/dataModel";

const PRIZE_TYPE = v.union(
  v.literal("general"),
  v.literal("track"),
  v.literal("sponsor"),
  v.literal("track_sponsor")
);

const SCORE_BASIS = v.union(
  v.literal("overall"),
  v.literal("categories"),
  v.literal("none")
);

const PRIZE_INPUT = v.object({
  prizeId: v.optional(v.id("prizes")),
  name: v.string(),
  description: v.optional(v.string()),
  type: PRIZE_TYPE,
  track: v.optional(v.string()),
  sponsorName: v.optional(v.string()),
  scoreBasis: v.optional(SCORE_BASIS),
  scoreCategoryNames: v.optional(v.array(v.string())),
  isActive: v.optional(v.boolean()),
  sortOrder: v.optional(v.number()),
});

async function getHackathonEvent(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">
): Promise<Doc<"events">> {
  const event = await ctx.db.get(eventId);
  if (!event) throw new Error("Event not found");
  if (event.mode === "demo_day") {
    throw new Error("Prize workflows are only supported for hackathon events");
  }
  return event;
}

function normalizeOptionalString(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function isTeamEligibleForPrize(team: Doc<"teams">, prize: Doc<"prizes">) {
  if (prize.isActive === false) return false;
  if (prize.type === "track" || prize.type === "track_sponsor") {
    return !!prize.track && !!team.track && team.track === prize.track;
  }
  return true;
}

function validatePrizeConfig(prize: any, event: any) {
  const name = prize.name?.trim();
  if (!name) {
    throw new Error("Prize name is required");
  }

  const eventTracks =
    event.tracks ||
    (event.categories || []).map((c: any) =>
      typeof c === "string" ? c : c.name
    );

  if (prize.type === "track" || prize.type === "track_sponsor") {
    if (!prize.track || !prize.track.trim()) {
      throw new Error(`Prize "${name}" must include a track`);
    }
    if (eventTracks.length > 0 && !eventTracks.includes(prize.track)) {
      throw new Error(`Prize "${name}" has an invalid track: ${prize.track}`);
    }
  }

  if (prize.type === "sponsor" || prize.type === "track_sponsor") {
    if (!prize.sponsorName || !prize.sponsorName.trim()) {
      throw new Error(`Prize "${name}" must include a sponsor`);
    }
  }

  if (prize.scoreBasis === "categories") {
    const categoryNames = new Set(
      (event.categories || []).map((c: any) => (typeof c === "string" ? c : c.name))
    );
    const selectedCategories = (prize.scoreCategoryNames || []).filter(Boolean);
    if (selectedCategories.length === 0) {
      throw new Error(`Prize "${name}" must select at least one scoring category`);
    }
    for (const categoryName of selectedCategories) {
      if (!categoryNames.has(categoryName)) {
        throw new Error(
          `Prize "${name}" references an unknown scoring category: ${categoryName}`
        );
      }
    }
  }
}

function sortPrizes(prizes: any[]) {
  return [...prizes].sort((a, b) => {
    const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });
}

export const listEventPrizes = query({
  args: { eventId: v.id("events") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event || event.mode === "demo_day") return [];

    const prizes = await ctx.db
      .query("prizes")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    return sortPrizes(prizes);
  },
});

export const saveEventPrizes = mutation({
  args: {
    eventId: v.id("events"),
    prizes: v.array(PRIZE_INPUT),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const event = await getHackathonEvent(ctx, args.eventId);

    const existingPrizes = await ctx.db
      .query("prizes")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const existingById = new Map(existingPrizes.map((p) => [p._id, p]));

    const retainedPrizeIds = new Set<any>();
    const now = Date.now();

    for (let index = 0; index < args.prizes.length; index += 1) {
      const incoming = args.prizes[index];
      validatePrizeConfig(incoming, event);

      const payload = {
        eventId: args.eventId,
        name: incoming.name.trim(),
        description: normalizeOptionalString(incoming.description),
        type: incoming.type,
        track: normalizeOptionalString(incoming.track),
        sponsorName: normalizeOptionalString(incoming.sponsorName),
        scoreBasis: incoming.scoreBasis ?? "none",
        scoreCategoryNames:
          incoming.scoreBasis === "categories"
            ? (incoming.scoreCategoryNames || []).map((c) => c.trim()).filter(Boolean)
            : undefined,
        isActive: incoming.isActive ?? true,
        sortOrder: incoming.sortOrder ?? index,
      };

      if (incoming.prizeId) {
        const existing = existingById.get(incoming.prizeId);
        if (!existing || existing.eventId !== args.eventId) {
          throw new Error("Invalid prize id");
        }
        await ctx.db.patch(incoming.prizeId, {
          ...payload,
          updatedAt: now,
        });
        retainedPrizeIds.add(incoming.prizeId);
      } else {
        const prizeId = await ctx.db.insert("prizes", {
          ...payload,
          createdAt: now,
          updatedAt: now,
          createdBy: adminId,
        });
        retainedPrizeIds.add(prizeId);
      }
    }

    for (const existing of existingPrizes) {
      if (retainedPrizeIds.has(existing._id)) continue;

      const [submissions, winners] = await Promise.all([
        ctx.db
          .query("teamPrizeSubmissions")
          .withIndex("by_prize", (q) => q.eq("prizeId", existing._id))
          .collect(),
        ctx.db
          .query("prizeWinners")
          .withIndex("by_prize", (q) => q.eq("prizeId", existing._id))
          .collect(),
      ]);

      await Promise.all(submissions.map((submission) => ctx.db.delete(submission._id)));
      await Promise.all(winners.map((winner) => ctx.db.delete(winner._id)));
      await ctx.db.delete(existing._id);
    }

    const updatedPrizes = await ctx.db
      .query("prizes")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    return sortPrizes(updatedPrizes);
  },
});

export const getMyTeamPrizeSubmissions = query({
  args: { eventId: v.id("events") },
  returns: v.array(v.id("prizes")),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const event = await ctx.db.get(args.eventId);
    if (!event || event.mode === "demo_day") return [];

    const team = await ctx.db
      .query("teams")
      .withIndex("by_event_and_submitter", (q) =>
        q.eq("eventId", args.eventId).eq("submittedBy", userId)
      )
      .first();

    if (!team) return [];

    const submissions = await ctx.db
      .query("teamPrizeSubmissions")
      .withIndex("by_event_and_team", (q) =>
        q.eq("eventId", args.eventId).eq("teamId", team._id)
      )
      .collect();

    return submissions.map((s) => s.prizeId);
  },
});

export const setMyTeamPrizeSubmissions = mutation({
  args: {
    eventId: v.id("events"),
    prizeIds: v.array(v.id("prizes")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const event = await getHackathonEvent(ctx, args.eventId);
    if (computeEventStatus(event) === "past") {
      throw new Error("Prize selection is closed for this event");
    }

    const team = await ctx.db
      .query("teams")
      .withIndex("by_event_and_submitter", (q) =>
        q.eq("eventId", args.eventId).eq("submittedBy", userId)
      )
      .first();

    if (!team) throw new Error("You need a team submission before selecting prizes");

    const uniquePrizeIds = Array.from(new Set(args.prizeIds));

    const eventPrizes = await ctx.db
      .query("prizes")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const eventPrizesById = new Map(eventPrizes.map((prize) => [prize._id, prize]));

    for (const prizeId of uniquePrizeIds) {
      const prize = eventPrizesById.get(prizeId);
      if (!prize) {
        throw new Error("One or more prize selections are invalid for this event");
      }
      if (!isTeamEligibleForPrize(team, prize)) {
        throw new Error(`Your team is not eligible for the prize \"${prize.name}\"`);
      }
    }

    const existing = await ctx.db
      .query("teamPrizeSubmissions")
      .withIndex("by_event_and_team", (q) =>
        q.eq("eventId", args.eventId).eq("teamId", team._id)
      )
      .collect();

    await Promise.all(existing.map((row) => ctx.db.delete(row._id)));

    const now = Date.now();
    await Promise.all(
      uniquePrizeIds.map((prizeId) =>
        ctx.db.insert("teamPrizeSubmissions", {
          eventId: args.eventId,
          teamId: team._id,
          prizeId,
          submittedAt: now,
          submittedBy: userId,
        })
      )
    );

    return null;
  },
});

export const setTeamPrizeSubmissionsAdmin = mutation({
  args: {
    eventId: v.id("events"),
    teamId: v.id("teams"),
    prizeIds: v.array(v.id("prizes")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await getHackathonEvent(ctx, args.eventId);

    const team = await ctx.db.get(args.teamId);
    if (!team || team.eventId !== args.eventId) {
      throw new Error("Invalid team for this event");
    }

    const uniquePrizeIds = Array.from(new Set(args.prizeIds));

    const eventPrizes = await ctx.db
      .query("prizes")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const eventPrizesById = new Map(eventPrizes.map((prize) => [prize._id, prize]));

    for (const prizeId of uniquePrizeIds) {
      const prize = eventPrizesById.get(prizeId);
      if (!prize) {
        throw new Error("One or more prize selections are invalid for this event");
      }
      if (!isTeamEligibleForPrize(team, prize)) {
        throw new Error(`Team is not eligible for the prize \"${prize.name}\"`);
      }
    }

    const existing = await ctx.db
      .query("teamPrizeSubmissions")
      .withIndex("by_event_and_team", (q) =>
        q.eq("eventId", args.eventId).eq("teamId", args.teamId)
      )
      .collect();

    await Promise.all(existing.map((row) => ctx.db.delete(row._id)));

    const now = Date.now();
    await Promise.all(
      uniquePrizeIds.map((prizeId) =>
        ctx.db.insert("teamPrizeSubmissions", {
          eventId: args.eventId,
          teamId: args.teamId,
          prizeId,
          submittedAt: now,
        })
      )
    );

    return null;
  },
});

export const getPrizeDeliberationData = query({
  args: { eventId: v.id("events") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const userIsAdmin = await isAdmin(ctx);
    if (!userIsAdmin) return null;

    const event = await ctx.db.get(args.eventId);
    if (!event || event.mode === "demo_day") return null;

    const [prizes, teams, submissions, scores] = await Promise.all([
      ctx.db
        .query("prizes")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect(),
      ctx.db
        .query("teams")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect(),
      ctx.db
        .query("teamPrizeSubmissions")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect(),
      ctx.db
        .query("scores")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect(),
    ]);

    const scoresByTeam = new Map<any, { avgScore: number; judgeCount: number }>();
    for (const team of teams) {
      const teamScores = scores.filter((s) => s.teamId === team._id);
      const avgScore =
        teamScores.length > 0
          ? teamScores.reduce((sum, s) => sum + s.totalScore, 0) / teamScores.length
          : 0;
      scoresByTeam.set(team._id, {
        avgScore,
        judgeCount: teamScores.length,
      });
    }

    const teamsById = new Map(teams.map((team) => [team._id, team]));
    const prizesById = new Map(prizes.map((prize) => [prize._id, prize]));
    const submissionsByPrize = new Map<any, any[]>();
    for (const submission of submissions) {
      const prize = prizesById.get(submission.prizeId);
      const team = teamsById.get(submission.teamId);
      if (!prize || !team) continue;
      if (!isTeamEligibleForPrize(team, prize)) continue;

      const existing = submissionsByPrize.get(submission.prizeId) || [];
      existing.push(submission);
      submissionsByPrize.set(submission.prizeId, existing);
    }

    const prizeCards = sortPrizes(prizes).map((prize) => {
      const prizeSubmissions = submissionsByPrize.get(prize._id) || [];
      const candidateTeams = prizeSubmissions
        .map((submission) => teamsById.get(submission.teamId))
        .filter((team): team is Doc<"teams"> => team !== undefined)
        .map((team) => {
          const metrics = scoresByTeam.get(team._id) || { avgScore: 0, judgeCount: 0 };
          return {
            teamId: team._id,
            teamName: team.name,
            track: team.track,
            githubUrl: team.githubUrl,
            devpostUrl: team.devpostUrl,
            averageScore: metrics.avgScore,
            judgeCount: metrics.judgeCount,
          };
        })
        .sort((a, b) => b.averageScore - a.averageScore);

      return {
        prize,
        submissionCount: candidateTeams.length,
        candidates: candidateTeams,
      };
    });

    return {
      eventId: args.eventId,
      scoringLockedAt: event.scoringLockedAt,
      prizes: prizeCards,
    };
  },
});

export const setPrizeWinners = mutation({
  args: {
    eventId: v.id("events"),
    winners: v.array(
      v.object({
        prizeId: v.id("prizes"),
        teamId: v.id("teams"),
        placement: v.optional(v.number()),
        notes: v.optional(v.string()),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const event = await getHackathonEvent(ctx, args.eventId);

    if (!event.scoringLockedAt) {
      throw new Error("Lock scoring before assigning prize winners");
    }

    const [prizes, teams, submissions] = await Promise.all([
      ctx.db
        .query("prizes")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect(),
      ctx.db
        .query("teams")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect(),
      ctx.db
        .query("teamPrizeSubmissions")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect(),
    ]);

    const validPrizeIds = new Set(prizes.map((prize) => prize._id));
    const validTeamIds = new Set(teams.map((team) => team._id));
    const submissionKeys = new Set(
      submissions.map((submission) => `${submission.prizeId}:${submission.teamId}`)
    );

    for (const winner of args.winners) {
      if (!validPrizeIds.has(winner.prizeId)) {
        throw new Error("One or more winners reference an invalid prize");
      }
      if (!validTeamIds.has(winner.teamId)) {
        throw new Error("One or more winners reference an invalid team");
      }
      if (!submissionKeys.has(`${winner.prizeId}:${winner.teamId}`)) {
        throw new Error("Winner must be selected from teams that submitted for that prize");
      }
    }

    const existing = await ctx.db
      .query("prizeWinners")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    await Promise.all(existing.map((winner) => ctx.db.delete(winner._id)));

    const now = Date.now();
    await Promise.all(
      args.winners.map((winner) =>
        ctx.db.insert("prizeWinners", {
          eventId: args.eventId,
          prizeId: winner.prizeId,
          teamId: winner.teamId,
          placement: winner.placement,
          notes: normalizeOptionalString(winner.notes),
          selectedAt: now,
          selectedBy: adminId,
        })
      )
    );

    return null;
  },
});

export const listPrizeWinners = query({
  args: { eventId: v.id("events") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event || event.mode === "demo_day") return [];

    const [winners, prizes, teams] = await Promise.all([
      ctx.db
        .query("prizeWinners")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect(),
      ctx.db
        .query("prizes")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect(),
      ctx.db
        .query("teams")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect(),
    ]);

    const prizesById = new Map(prizes.map((prize) => [prize._id, prize]));
    const teamsById = new Map(teams.map((team) => [team._id, team]));

    return winners
      .map((winner) => ({
        ...winner,
        prize: prizesById.get(winner.prizeId),
        team: teamsById.get(winner.teamId),
      }))
      .sort((a, b) => {
        const orderA = a.prize?.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.prize?.sortOrder ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        const placementA = a.placement ?? Number.MAX_SAFE_INTEGER;
        const placementB = b.placement ?? Number.MAX_SAFE_INTEGER;
        return placementA - placementB;
      });
  },
});
