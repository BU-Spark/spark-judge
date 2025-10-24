import { QueryCtx, MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

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
