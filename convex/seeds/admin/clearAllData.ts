import { MutationCtx } from "../../_generated/server";

export async function clearAllDataHandler(ctx: MutationCtx) {
  // Child tables first so no row is left pointing at a deleted parent.
  const appTables = [
    "appreciations",
    "demoDayCaptchaPasses",
    "demoDayIntegrityFindings",
    "prizeWinners",
    "teamPrizeSubmissions",
    "prizes",
    "rankedVotes",
    "scores",
    "judgeAssignments",
    "judges",
    "participants",
    "teams",
    "events",
  ] as const;
  const cleared: Record<string, number> = {};
  for (const table of appTables) {
    const rows = await ctx.db.query(table).collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    cleared[table] = rows.length;
  }

  // Clear ALL auth-related tables
  try {
    const authSessions = await ctx.db.query("authSessions").collect();
    for (const session of authSessions) {
      await ctx.db.delete(session._id);
    }
  } catch {
    console.log("No authSessions table or already empty");
  }

  try {
    const authAccounts = await ctx.db.query("authAccounts").collect();
    for (const account of authAccounts) {
      await ctx.db.delete(account._id);
    }
  } catch {
    console.log("No authAccounts table or already empty");
  }

  try {
    const authVerificationCodes = await ctx.db
      .query("authVerificationCodes")
      .collect();
    for (const code of authVerificationCodes) {
      await ctx.db.delete(code._id);
    }
  } catch {
    console.log("No authVerificationCodes table or already empty");
  }

  try {
    const authVerifiers = await ctx.db.query("authVerifiers").collect();
    for (const verifier of authVerifiers) {
      await ctx.db.delete(verifier._id);
    }
  } catch {
    console.log("No authVerifiers table or already empty");
  }

  try {
    const authRefreshTokens = await ctx.db.query("authRefreshTokens").collect();
    for (const token of authRefreshTokens) {
      await ctx.db.delete(token._id);
    }
  } catch {
    console.log("No authRefreshTokens table or already empty");
  }

  // Clear users LAST (be careful with this!)
  const users = await ctx.db.query("users").collect();
  for (const user of users) {
    await ctx.db.delete(user._id);
  }

  return {
    message: "All data cleared successfully including all auth data",
    cleared: { ...cleared, users: users.length },
  };
}
