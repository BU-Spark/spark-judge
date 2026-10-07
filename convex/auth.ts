import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import Google from "@auth/core/providers/google";
import { query } from "./_generated/server";
import { authRedirect } from "./authRedirect";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Google],
  callbacks: {
    redirect: async ({ redirectTo }) => {
      if (!process.env.SITE_URL) throw new Error("SITE_URL is required");
      return authRedirect(redirectTo, process.env.SITE_URL);
    },
  },
});

export const loggedInUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }
    return user;
  },
});
