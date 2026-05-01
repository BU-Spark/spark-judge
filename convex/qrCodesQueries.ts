import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

// Internal queries for fetching data (used by QR code actions)

export const getEventInternal = internalQuery({
  args: { eventId: v.id("events") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("events"),
      name: v.string(),
      mode: v.optional(
        v.union(
          v.literal("hackathon"),
          v.literal("demo_day"),
          v.literal("code_and_tell"),
        ),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) return null;
    return {
      _id: event._id,
      name: event.name,
      mode: event.mode,
    };
  },
});

export const getTeamInternal = internalQuery({
  args: { teamId: v.id("teams") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("teams"),
      eventId: v.id("events"),
      name: v.string(),
      courseCode: v.optional(v.string()),
      hidden: v.optional(v.boolean()),
      demoDaySignName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) return null;
    return {
      _id: team._id,
      eventId: team.eventId,
      name: team.name,
      courseCode: team.courseCode,
      hidden: team.hidden,
      demoDaySignName: team.demoDaySignName,
    };
  },
});

export const getTeamsInternal = internalQuery({
  args: { eventId: v.id("events") },
  returns: v.array(
    v.object({
      _id: v.id("teams"),
      eventId: v.id("events"),
      name: v.string(),
      courseCode: v.optional(v.string()),
      hidden: v.optional(v.boolean()),
      demoDayRound: v.optional(v.number()),
      demoDayBoardNumber: v.optional(v.string()),
      demoDayProjectInstance: v.optional(v.string()),
      airtableProjectRecordId: v.optional(v.string()),
      airtableProjectInstanceRecordId: v.optional(v.string()),
      demoDaySignName: v.optional(v.string()),
      demoDayFullSignName: v.optional(v.string()),
      demoDayBoardTime: v.optional(v.string()),
      demoDayCourseName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    return teams.map((team) => ({
      _id: team._id,
      eventId: team.eventId,
      name: team.name,
      courseCode: team.courseCode,
      hidden: team.hidden,
      demoDayRound: team.demoDayRound,
      demoDayBoardNumber: team.demoDayBoardNumber,
      demoDayProjectInstance: team.demoDayProjectInstance,
      airtableProjectRecordId: team.airtableProjectRecordId,
      airtableProjectInstanceRecordId: team.airtableProjectInstanceRecordId,
      demoDaySignName: team.demoDaySignName,
      demoDayFullSignName: team.demoDayFullSignName,
      demoDayBoardTime: team.demoDayBoardTime,
      demoDayCourseName: team.demoDayCourseName,
    }));
  },
});
