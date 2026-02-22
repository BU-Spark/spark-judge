import { MutationCtx } from "../../_generated/server";

export async function clearAllDataHandler(ctx: MutationCtx) {
  // Clear events
  const events = await ctx.db.query("events").collect();
  for (const event of events) {
    await ctx.db.delete(event._id);
  }

  // Clear teams
  const teams = await ctx.db.query("teams").collect();
  for (const team of teams) {
    await ctx.db.delete(team._id);
  }

  // Clear scores
  const scores = await ctx.db.query("scores").collect();
  for (const score of scores) {
    await ctx.db.delete(score._id);
  }

  // Clear judges
  const judges = await ctx.db.query("judges").collect();
  for (const judge of judges) {
    await ctx.db.delete(judge._id);
  }

  // Clear participants
  const participants = await ctx.db.query("participants").collect();
  for (const participant of participants) {
    await ctx.db.delete(participant._id);
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
    cleared: {
      events: events.length,
      teams: teams.length,
      scores: scores.length,
      judges: judges.length,
      participants: participants.length,
      users: users.length,
    },
  };
}
