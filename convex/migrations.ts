import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Remove isAdmin field from all judge records (migration from per-event admin to global admin)
 */
export const removeJudgeIsAdmin = internalMutation({
  args: {},
  returns: v.object({
    message: v.string(),
    judgesUpdated: v.number(),
  }),
  handler: async (ctx) => {
    const judges = await ctx.db.query("judges").collect();
    let count = 0;

    for (const judge of judges) {
      // Check if the judge has the old isAdmin field
      if ("isAdmin" in judge) {
        // Remove the isAdmin field by replacing with a clean object
        await ctx.db.replace(judge._id, {
          userId: judge.userId,
          eventId: judge.eventId,
        });
        count++;
      }
    }

    return {
      message: `Successfully removed isAdmin from ${count} judge records`,
      judgesUpdated: count,
    };
  },
});

/**
 * Backfill existing events with mode = "hackathon" for Demo Day feature rollout.
 * This ensures backwards compatibility - events without mode are treated as hackathons.
 * Run this migration once after deploying the schema changes.
 */
export const backfillEventMode = internalMutation({
  args: {},
  returns: v.object({
    message: v.string(),
    eventsUpdated: v.number(),
  }),
  handler: async (ctx) => {
    const events = await ctx.db.query("events").collect();
    let count = 0;

    for (const event of events) {
      // Only update events that don't have a mode set
      if (event.mode === undefined) {
        await ctx.db.patch(event._id, { mode: "hackathon" });
        count++;
      }
    }

    return {
      message: `Successfully set mode="hackathon" on ${count} events`,
      eventsUpdated: count,
    };
  },
});

