import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isAdmin, requireAdmin } from "./helpers";

export const submitScore = mutation({
  args: {
    teamId: v.id("teams"),
    eventId: v.id("events"),
    categoryScores: v.array(
      v.object({
        category: v.string(),
        score: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const judge = await ctx.db
      .query("judges")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId)
      )
      .first();

    if (!judge) throw new Error("Not a judge for this event");

    // Fetch event to get category weights
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");

    const totalScore = args.categoryScores.reduce((sum, cs) => {
      const category = event.categories.find((c) => c.name === cs.category);
      const weight = category?.weight ?? 1;
      return sum + cs.score * weight;
    }, 0);

    const existing = await ctx.db
      .query("scores")
      .withIndex("by_judge_and_team", (q) =>
        q.eq("judgeId", judge._id).eq("teamId", args.teamId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        categoryScores: args.categoryScores,
        totalScore,
        submittedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("scores", {
      judgeId: judge._id,
      teamId: args.teamId,
      eventId: args.eventId,
      categoryScores: args.categoryScores,
      totalScore,
      submittedAt: Date.now(),
    });
  },
});

export const submitBatchScores = mutation({
  args: {
    eventId: v.id("events"),
    scores: v.array(
      v.object({
        teamId: v.id("teams"),
        categoryScores: v.array(
          v.object({
            category: v.string(),
            score: v.number(),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const judge = await ctx.db
      .query("judges")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId)
      )
      .first();

    if (!judge) throw new Error("Not a judge for this event");

    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");

    const teamsForEvent = await ctx.db
      .query("teams")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    const teamIds = new Set(teamsForEvent.map((team) => team._id.toString()));

    for (const entry of args.scores) {
      if (!teamIds.has(entry.teamId.toString())) {
        throw new Error("Invalid team for this event");
      }
    }

    await Promise.all(
      args.scores.map(async (entry) => {
        const totalScore = entry.categoryScores.reduce((sum, cs) => {
          const category = event.categories.find((c) => c.name === cs.category);
          const weight = category?.weight ?? 1;
          return sum + cs.score * weight;
        }, 0);

        const existing = await ctx.db
          .query("scores")
          .withIndex("by_judge_and_team", (q) =>
            q.eq("judgeId", judge._id).eq("teamId", entry.teamId)
          )
          .first();

        if (existing) {
          await ctx.db.patch(existing._id, {
            categoryScores: entry.categoryScores,
            totalScore,
            submittedAt: Date.now(),
          });
        } else {
          await ctx.db.insert("scores", {
            judgeId: judge._id,
            teamId: entry.teamId,
            eventId: args.eventId,
            categoryScores: entry.categoryScores,
            totalScore,
            submittedAt: Date.now(),
          });
        }
      })
    );
  },
});

export const getMyScores = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const judge = await ctx.db
      .query("judges")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId)
      )
      .first();

    if (!judge) return [];

    return await ctx.db
      .query("scores")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .filter((q) => q.eq(q.field("judgeId"), judge._id))
      .collect();
  },
});

export const getTeamScore = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const team = await ctx.db.get(args.teamId);
    if (!team) return null;

    const judge = await ctx.db
      .query("judges")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", team.eventId)
      )
      .first();

    if (!judge) return null;

    return await ctx.db
      .query("scores")
      .withIndex("by_judge_and_team", (q) =>
        q.eq("judgeId", judge._id).eq("teamId", args.teamId)
      )
      .first();
  },
});

export const getEventScores = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const userIsAdmin = await isAdmin(ctx);
    if (!userIsAdmin) return null;

    const scores = await ctx.db
      .query("scores")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    const teamScores = teams.map((team) => {
      const teamScoresList = scores.filter((s) => s.teamId === team._id);
      const avgTotal =
        teamScoresList.length > 0
          ? teamScoresList.reduce((sum, s) => sum + s.totalScore, 0) /
            teamScoresList.length
          : 0;

      return {
        team,
        averageScore: avgTotal,
        judgeCount: teamScoresList.length,
        scores: teamScoresList,
      };
    });

    return teamScores.sort((a, b) => b.averageScore - a.averageScore);
  },
});

export const setWinners = mutation({
  args: {
    eventId: v.id("events"),
    overallWinner: v.id("teams"),
    categoryWinners: v.array(
      v.object({
        category: v.string(),
        teamId: v.id("teams"),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    await ctx.db.patch(args.eventId, {
      overallWinner: args.overallWinner,
      categoryWinners: args.categoryWinners,
    });
  },
});

export const releaseResults = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.eventId, { resultsReleased: true });
  },
});

export const getDetailedEventScores = query({
  args: { eventId: v.id("events") },
  returns: v.union(
    v.null(),
    v.object({
      teamRankings: v.array(v.any()),
      categoryRankings: v.any(),
      judgeBreakdown: v.array(v.any()),
      categories: v.array(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const userIsAdmin = await isAdmin(ctx);
    if (!userIsAdmin) return null;

    const event = await ctx.db.get(args.eventId);
    if (!event) return null;

    const scores = await ctx.db
      .query("scores")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    const judges = await ctx.db
      .query("judges")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    // Get judge names and admin status
    const judgeMap = new Map<string, { name: string; isAdmin: boolean }>();
    for (const j of judges) {
      const user = await ctx.db.get(j.userId);
      if (user) {
        judgeMap.set(j._id, {
          name: user.name || user.email || "Unknown",
          isAdmin: (user as any).isAdmin === true,
        });
      }
    }

    // Calculate overall rankings
    const teamRankings = teams.map((team) => {
      const teamScoresList = scores.filter((s) => s.teamId === team._id);
      const avgTotal =
        teamScoresList.length > 0
          ? teamScoresList.reduce((sum, s) => sum + s.totalScore, 0) /
            teamScoresList.length
          : 0;

      // Calculate average per category
      const categoryAverages: Record<string, number> = {};
      event.categories.forEach((catObj) => {
        const categoryScores = teamScoresList
          .map((s) =>
            s.categoryScores.find((cs) => cs.category === catObj.name)
          )
          .filter((cs) => cs !== undefined)
          .map((cs) => cs!.score);

        categoryAverages[catObj.name] =
          categoryScores.length > 0
            ? categoryScores.reduce((sum, score) => sum + score, 0) /
              categoryScores.length
            : 0;
      });

      return {
        team,
        averageScore: avgTotal,
        judgeCount: teamScoresList.length,
        categoryAverages,
        scores: teamScoresList,
      };
    });

    teamRankings.sort((a, b) => b.averageScore - a.averageScore);

    // Calculate category-specific rankings
    const categoryRankings: Record<string, any[]> = {};
    event.categories.forEach((catObj) => {
      const categoryTeams = teamRankings
        .map((tr) => ({
          team: tr.team,
          categoryAverage: tr.categoryAverages[catObj.name],
          judgeCount: tr.judgeCount,
        }))
        .sort((a, b) => b.categoryAverage - a.categoryAverage);

      categoryRankings[catObj.name] = categoryTeams;
    });

    // Judge breakdown
    const judgeBreakdown = judges.map((j) => {
      const judgeScores = scores.filter((s) => s.judgeId === j._id);
      const judgeInfo = judgeMap.get(j._id);
      return {
        judgeName: judgeInfo?.name || "Unknown",
        isAdmin: judgeInfo?.isAdmin || false,
        teamsScored: judgeScores.length,
        scores: judgeScores.map((s) => ({
          teamId: s.teamId,
          teamName: teams.find((t) => t._id === s.teamId)?.name || "Unknown",
          totalScore: s.totalScore,
          categoryScores: s.categoryScores,
        })),
      };
    });

    return {
      teamRankings,
      categoryRankings,
      judgeBreakdown,
      categories: event.categories.map((c) => c.name),
    };
  },
});
