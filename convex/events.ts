import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isAdmin, requireAdmin } from "./helpers";

export const listEvents = query({
  args: {},
  returns: v.object({
    upcoming: v.array(v.any()),
    active: v.array(v.any()),
    past: v.array(v.any()),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const userIsAdmin = await isAdmin(ctx);
    const events = await ctx.db.query("events").collect();

    const eventsWithTeamCounts = await Promise.all(
      events.map(async (event) => {
        const teams = await ctx.db
          .query("teams")
          .withIndex("by_event", (q) => q.eq("eventId", event._id))
          .collect();

        // Check user's role for this event
        let userRole = null;
        if (userId) {
          const judge = await ctx.db
            .query("judges")
            .withIndex("by_user_and_event", (q) =>
              q.eq("userId", userId).eq("eventId", event._id)
            )
            .first();

          if (judge) {
            userRole = { role: "judge" as const, isAdmin: userIsAdmin };
          } else {
            const participant = await ctx.db
              .query("participants")
              .withIndex("by_user_and_event", (q) =>
                q.eq("userId", userId).eq("eventId", event._id)
              )
              .first();

            if (participant) {
              userRole = { role: "participant" as const };
            }
          }
        }

        return {
          ...event,
          teamCount: teams.length,
          userRole,
          requiresJudgeCode: event.status === "active" && !!event.judgeCode,
        };
      })
    );

    return {
      upcoming: eventsWithTeamCounts.filter((e) => e.status === "upcoming"),
      active: eventsWithTeamCounts.filter((e) => e.status === "active"),
      past: eventsWithTeamCounts.filter((e) => e.status === "past"),
    };
  },
});

export const getEvent = query({
  args: { eventId: v.id("events") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) return null;

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    return { ...event, teams };
  },
});

export const joinAsJudge = mutation({
  args: { eventId: v.id("events") },
  returns: v.id("judges"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if already a participant
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId)
      )
      .first();

    if (participant) {
      throw new Error("You are already a participant for this event");
    }

    const existing = await ctx.db
      .query("judges")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("judges", {
      userId,
      eventId: args.eventId,
    });
  },
});

export const verifyJudgeCodeAndStartJudging = mutation({
  args: {
    eventId: v.id("events"),
    judgeCode: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");

    // Verify event is active
    if (event.status !== "active") {
      throw new Error("Event is not currently active");
    }

    // Verify user is a judge
    const judge = await ctx.db
      .query("judges")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId)
      )
      .first();

    if (!judge) {
      throw new Error("You are not registered as a judge for this event");
    }

    // Validate judge code
    if (event.judgeCode && event.judgeCode !== args.judgeCode) {
      throw new Error("Invalid judge code");
    }

    return true;
  },
});

export const getJudgeStatus = query({
  args: { eventId: v.id("events") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const judge = await ctx.db
      .query("judges")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId)
      )
      .first();

    return judge;
  },
});

export const createEvent = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("upcoming"),
      v.literal("active"),
      v.literal("past")
    ),
    startDate: v.number(),
    endDate: v.number(),
    categories: v.array(v.string()),
    tracks: v.optional(v.array(v.string())),
    judgeCode: v.optional(v.string()),
  },
  returns: v.id("events"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Make the creator a global admin if they're not already
    const user = await ctx.db.get(userId);
    if (user && !user.isAdmin) {
      await ctx.db.patch(userId, { isAdmin: true });
    }

    const eventId = await ctx.db.insert("events", {
      ...args,
      resultsReleased: false,
    });

    return eventId;
  },
});

export const updateEventStatus = mutation({
  args: {
    eventId: v.id("events"),
    status: v.union(
      v.literal("upcoming"),
      v.literal("active"),
      v.literal("past")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.eventId, { status: args.status });
    return null;
  },
});

export const removeEvent = mutation({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, { eventId }) => {
    await requireAdmin(ctx);

    const event = await ctx.db.get(eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    const [scores, teams, judges, participants] = await Promise.all([
      ctx.db
        .query("scores")
        .withIndex("by_event", (q) => q.eq("eventId", eventId))
        .collect(),
      ctx.db
        .query("teams")
        .withIndex("by_event", (q) => q.eq("eventId", eventId))
        .collect(),
      ctx.db
        .query("judges")
        .withIndex("by_event", (q) => q.eq("eventId", eventId))
        .collect(),
      ctx.db
        .query("participants")
        .withIndex("by_event", (q) => q.eq("eventId", eventId))
        .collect(),
    ]);

    await Promise.all(scores.map((score) => ctx.db.delete(score._id)));

    for (const team of teams) {
      if (team.logoStorageId) {
        await ctx.storage.delete(team.logoStorageId);
      }
      await ctx.db.delete(team._id);
    }

    await Promise.all(judges.map((judge) => ctx.db.delete(judge._id)));
    await Promise.all(
      participants.map((participant) => ctx.db.delete(participant._id))
    );

    await ctx.db.delete(eventId);
    return null;
  },
});

export const duplicateEvent = mutation({
  args: { eventId: v.id("events") },
  returns: v.id("events"),
  handler: async (ctx, { eventId }) => {
    const userId = await requireAdmin(ctx);

    const event = await ctx.db.get(eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    const baseName = event.name.replace(/\s\(Copy(?: \d+)?\)$/, "");
    let copyIndex = 0;
    let newName = `${baseName} (Copy)`;

    const existingEvents = await ctx.db.query("events").collect();
    const nameSet = new Set(existingEvents.map((e) => e.name));

    while (nameSet.has(newName)) {
      copyIndex += 1;
      newName = `${baseName} (Copy ${copyIndex + 1})`;
    }

    const newEventId = await ctx.db.insert("events", {
      name: newName,
      description: event.description,
      status: "upcoming",
      startDate: event.startDate,
      endDate: event.endDate,
      categories: event.categories,
      tracks: event.tracks,
      resultsReleased: false,
      judgeCode: undefined,
    });

    return newEventId;
  },
});

export const isUserAdmin = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;

    const user = await ctx.db.get(userId);
    return user?.isAdmin === true;
  },
});
