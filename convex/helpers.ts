import { QueryCtx, MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// Demo Day constants - exported for use in other modules
export const DEMO_DAY_CONSTANTS = {
  MAX_TAPS_PER_PROJECT_PER_ATTENDEE: 3,
  MAX_TAPS_PER_ATTENDEE: 100,
  IP_RATE_LIMIT_WINDOW_MS: 10 * 60 * 1000, // 10 minutes
  IP_RATE_LIMIT_MAX: 100, // Max appreciations from same IP in window
} as const;

/**
 * Check if the current user is a global admin
 */
export async function isAdmin(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return false;

  const user = await ctx.db.get(userId as Id<"users">);
  return user?.isAdmin === true;
}

/**
 * Get the current user ID or throw an error
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx
): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId as Id<"users">;
}

/**
 * Require that the current user is an admin or throw an error
 */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<Id<"users">> {
  const userId = await requireAuth(ctx);
  const user = await ctx.db.get(userId);
  if (!user || !("isAdmin" in user) || !user.isAdmin) {
    throw new Error("Not authorized - admin access required");
  }
  return userId;
}

/**
 * Compute event status based on current time and start/end dates
 * - If now < startDate → "upcoming"
 * - If startDate <= now <= endDate → "active"
 * - If now > endDate → "past"
 */
export function computeEventStatus(event: {
  startDate: number;
  endDate: number;
}): "upcoming" | "active" | "past" {
  const now = Date.now();

  if (now < event.startDate) {
    return "upcoming";
  } else if (now > event.endDate) {
    return "past";
  } else {
    return "active";
  }
}
