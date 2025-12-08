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
      mode: v.optional(v.union(v.literal("hackathon"), v.literal("demo_day"))),
    })
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
    })
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
    })
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
    }));
  },
});

