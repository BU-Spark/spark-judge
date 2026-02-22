import { getAuthUserId } from "@convex-dev/auth/server";
import { MutationCtx } from "../../_generated/server";
import { normalizeAuthenticatedUserId } from "../shared/auth";

export async function makeCurrentUserAdminForAllEventsHandler(ctx: MutationCtx) {
  const userId = normalizeAuthenticatedUserId(await getAuthUserId(ctx));

  if (!userId) {
    throw new Error(
      "You must be signed into the app (not just the Convex dashboard). Open your app, sign in with Google, then run this function again."
    );
  }

  // Make user a global admin
  await ctx.db.patch(userId, { isAdmin: true });

  // Add them as a judge to all events they're not already judging
  const events = await ctx.db.query("events").collect();
  let added = 0;

  for (const event of events) {
    // Check if already a judge
    const existing = await ctx.db
      .query("judges")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", userId).eq("eventId", event._id)
      )
      .first();

    if (!existing) {
      // Add as judge
      await ctx.db.insert("judges", {
        userId,
        eventId: event._id,
      });
      added++;
    }
  }

  return {
    message: `Made you a global admin and added you as judge to ${added} events`,
    userId,
  };
}

export async function makeUserAdminByEmailHandler(
  ctx: MutationCtx,
  args: { email: string }
) {
  // Find user by email
  const user = await ctx.db
    .query("users")
    .filter((q) => q.eq(q.field("email"), args.email))
    .first();

  if (!user) {
    return {
      message: `No user found with email: ${args.email}`,
    };
  }

  // Make user a global admin
  await ctx.db.patch(user._id, { isAdmin: true });

  // Add them as a judge to all events they're not already judging
  const events = await ctx.db.query("events").collect();
  let added = 0;

  for (const event of events) {
    // Check if already a judge
    const existing = await ctx.db
      .query("judges")
      .withIndex("by_user_and_event", (q) =>
        q.eq("userId", user._id).eq("eventId", event._id)
      )
      .first();

    if (!existing) {
      // Add as judge
      await ctx.db.insert("judges", {
        userId: user._id,
        eventId: event._id,
      });
      added++;
    }
  }

  return {
    message: `Made ${args.email} a global admin and added them as judge to ${added} events`,
    userId: user._id,
  };
}
