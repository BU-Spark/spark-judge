import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "../../_generated/dataModel";
import { MutationCtx } from "../../_generated/server";

const DEFAULT_SEED_ADMIN_NAME = "Demo Admin";
const DEFAULT_SEED_ADMIN_EMAIL = "admin@demo.com";

type EnsureSeedAdminUserOptions = {
  name?: string;
  email?: string;
  emailFactory?: () => string;
};

export function isInvalidSeedAuthId(userId: string | null | undefined) {
  return Boolean(userId && (userId === "fake_id" || userId.startsWith("fake")));
}

export function normalizeAuthenticatedUserId(
  userId: Id<"users"> | null
): Id<"users"> | null {
  if (!userId) return null;
  return isInvalidSeedAuthId(userId) ? null : userId;
}

function resolveSeedEmail(options: EnsureSeedAdminUserOptions) {
  if (options.emailFactory) return options.emailFactory();
  if (options.email) return options.email;
  return DEFAULT_SEED_ADMIN_EMAIL;
}

async function insertSeedUser(
  ctx: MutationCtx,
  options: EnsureSeedAdminUserOptions
): Promise<Id<"users">> {
  return ctx.db.insert("users", {
    name: options.name ?? DEFAULT_SEED_ADMIN_NAME,
    email: resolveSeedEmail(options),
    emailVerificationTime: Date.now(),
    isAnonymous: false,
  });
}

export async function ensureSeedAdminUser(
  ctx: MutationCtx,
  options: EnsureSeedAdminUserOptions = {}
): Promise<Id<"users">> {
  let userId = normalizeAuthenticatedUserId(await getAuthUserId(ctx));

  if (!userId) {
    userId = await insertSeedUser(ctx, options);
  } else {
    const existingUser = await ctx.db.get(userId);
    if (!existingUser) {
      userId = await insertSeedUser(ctx, options);
    }
  }

  await ctx.db.patch(userId, { isAdmin: true });
  return userId;
}
