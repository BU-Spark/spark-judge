import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { computeEventStatus } from "./helpers";

export const getUserProfile = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      user: v.object({
        _id: v.id("users"),
        _creationTime: v.number(),
        name: v.optional(v.string()),
        email: v.optional(v.string()),
        bio: v.optional(v.string()),
      }),
      pastEvents: v.array(
        v.object({
          event: v.any(),
          judgeRecord: v.any(),
          teamsJudged: v.number(),
          scoresSubmitted: v.number(),
        })
      ),
      activeEvents: v.array(
        v.object({
          event: v.any(),
          judgeRecord: v.any(),
          teamsJudged: v.number(),
          scoresSubmitted: v.number(),
        })
      ),
      upcomingEvents: v.array(
        v.object({
          event: v.any(),
          judgeRecord: v.any(),
          teamsJudged: v.number(),
          scoresSubmitted: v.number(),
        })
      ),
      stats: v.object({
        totalEvents: v.number(),
        totalTeamsScored: v.number(),
        averageScore: v.number(),
      }),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = (await ctx.db.get(userId)) as {
      _id: Id<"users">;
      _creationTime: number;
      name?: string | undefined;
      email?: string | undefined;
      phone?: string | undefined;
      image?: string | undefined;
      emailVerificationTime?: number | undefined;
      phoneVerificationTime?: number | undefined;
      isAnonymous?: boolean | undefined;
      bio?: string | undefined;
    } | null;
    if (!user) return null;

    // Get all judge records for this user
    const judgeRecords = await ctx.db
      .query("judges")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Fetch events and scores for each judge record
    const eventsData = await Promise.all(
      judgeRecords.map(async (judgeRecord) => {
        const event = await ctx.db.get(judgeRecord.eventId);
        if (!event) return null;

        // Get scores submitted by this judge
        const scores = await ctx.db
          .query("scores")
          .withIndex("by_event", (q) => q.eq("eventId", event._id))
          .filter((q) => q.eq(q.field("judgeId"), judgeRecord._id))
          .collect();

        // Get unique teams judged
        const uniqueTeams = new Set(scores.map((s) => s.teamId));

        return {
          event,
          judgeRecord,
          teamsJudged: uniqueTeams.size,
          scoresSubmitted: scores.length,
          scores,
        };
      })
    );

    // Filter out null values and separate by event status (computed from dates)
    const validEventsData = eventsData.filter((e) => e !== null);

    const pastEvents = validEventsData
      .filter((e) => computeEventStatus(e!.event) === "past")
      .map(({ scores, ...rest }) => rest);

    const activeEvents = validEventsData
      .filter((e) => computeEventStatus(e!.event) === "active")
      .map(({ scores, ...rest }) => rest);

    const upcomingEvents = validEventsData
      .filter((e) => computeEventStatus(e!.event) === "upcoming")
      .map(({ scores, ...rest }) => rest);

    // Calculate statistics
    const allScores = validEventsData.flatMap((e) => e!.scores);
    const totalTeamsScored = new Set(allScores.map((s) => s.teamId)).size;
    const averageScore =
      allScores.length > 0
        ? allScores.reduce((sum, s) => sum + s.totalScore, 0) / allScores.length
        : 0;

    return {
      user: {
        _id: user._id,
        _creationTime: user._creationTime,
        name: user.name,
        email: user.email,
        bio: user.bio,
      },
      pastEvents,
      activeEvents,
      upcomingEvents,
      stats: {
        totalEvents: judgeRecords.length,
        totalTeamsScored,
        averageScore: Math.round(averageScore * 10) / 10, // Round to 1 decimal
      },
    };
  },
});
