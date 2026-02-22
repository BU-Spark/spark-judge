import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const addTeamToAssignment = mutation({
  args: {
    eventId: v.id("events"),
    teamId: v.id("teams"),
  },
  returns: v.id("judgeAssignments"),
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

    const team = await ctx.db.get(args.teamId);
    if (!team || team.eventId !== args.eventId) {
      throw new Error("Invalid team for this event");
    }

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }
    if (event.mode !== "demo_day" && event.scoringLockedAt) {
      throw new Error("Scoring is locked for this event");
    }

    // Check if assignment already exists
    const existing = await ctx.db
      .query("judgeAssignments")
      .withIndex("by_judge_and_team", (q) =>
        q.eq("judgeId", judge._id).eq("teamId", args.teamId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("judgeAssignments", {
      judgeId: judge._id,
      eventId: args.eventId,
      teamId: args.teamId,
      addedAt: Date.now(),
    });
  },
});

export const addMultipleTeamsToAssignment = mutation({
  args: {
    eventId: v.id("events"),
    teamIds: v.array(v.id("teams")),
  },
  returns: v.number(),
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
    if (!event) {
      throw new Error("Event not found");
    }
    if (event.mode !== "demo_day" && event.scoringLockedAt) {
      throw new Error("Scoring is locked for this event");
    }

    // Get judge's existing assignments for this event to avoid duplicates
    const existingAssignments = await ctx.db
      .query("judgeAssignments")
      .withIndex("by_judge_and_event", (q) =>
        q.eq("judgeId", judge._id).eq("eventId", args.eventId)
      )
      .collect();

    const existingTeamIds = new Set(existingAssignments.map((a) => a.teamId));
    let addedCount = 0;

    for (const teamId of args.teamIds) {
      if (existingTeamIds.has(teamId)) continue;

      // Verify team belongs to event
      const team = await ctx.db.get(teamId);
      if (!team || team.eventId !== args.eventId) continue;

      await ctx.db.insert("judgeAssignments", {
        judgeId: judge._id,
        eventId: args.eventId,
        teamId: team._id,
        addedAt: Date.now(),
      });
      existingTeamIds.add(teamId); // Update set in case of duplicates in array
      addedCount++;
    }

    return addedCount;
  },
});

export const removeTeamFromAssignment = mutation({
  args: {
    eventId: v.id("events"),
    teamId: v.id("teams"),
  },
  returns: v.null(),
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

    const team = await ctx.db.get(args.teamId);
    if (!team || team.eventId !== args.eventId) {
      throw new Error("Invalid team for this event");
    }

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }
    if (event.mode !== "demo_day" && event.scoringLockedAt) {
      throw new Error("Scoring is locked for this event");
    }

    const assignment = await ctx.db
      .query("judgeAssignments")
      .withIndex("by_judge_and_team", (q) =>
        q.eq("judgeId", judge._id).eq("teamId", args.teamId)
      )
      .first();

    if (assignment) {
      await ctx.db.delete(assignment._id);
    }

    const existingScore = await ctx.db
      .query("scores")
      .withIndex("by_judge_and_team", (q) =>
        q.eq("judgeId", judge._id).eq("teamId", args.teamId)
      )
      .first();

    if (existingScore) {
      await ctx.db.delete(existingScore._id);
    }

    return null;
  },
});

export const getMyAssignments = query({
  args: { eventId: v.id("events") },
  returns: v.array(v.id("teams")),
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

    const assignments = await ctx.db
      .query("judgeAssignments")
      .withIndex("by_judge_and_event", (q) =>
        q.eq("judgeId", judge._id).eq("eventId", args.eventId)
      )
      .collect();

    return assignments.map((a) => a.teamId);
  },
});
