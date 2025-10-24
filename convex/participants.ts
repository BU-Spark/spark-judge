import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isAdmin } from "./helpers";

export const getUserEventRole = query({
  args: { eventId: v.id("events") },
  returns: v.union(
    v.null(),
    v.object({
      role: v.union(v.literal("judge"), v.literal("participant")),
      isAdmin: v.optional(v.boolean()),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const userIsAdmin = await isAdmin(ctx);

    const judge = await ctx.db
      .query("judges")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId)
      )
      .first();

    if (judge) {
      return { role: "judge" as const, isAdmin: userIsAdmin };
    }

    const participant = await ctx.db
      .query("participants")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId)
      )
      .first();

    if (participant) {
      return { role: "participant" as const };
    }

    return null;
  },
});

export const joinAsParticipant = mutation({
  args: { eventId: v.id("events") },
  returns: v.id("participants"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const event = await ctx.db.get(args.eventId);
    if (!event || event.status !== "active") {
      throw new Error("Can only join as participant for active events");
    }

    const judge = await ctx.db
      .query("judges")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId)
      )
      .first();

    if (judge) {
      throw new Error("You are already a judge for this event");
    }

    const existing = await ctx.db
      .query("participants")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId)
      )
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("participants", {
      userId,
      eventId: args.eventId,
      createdAt: Date.now(),
    });
  },
});
