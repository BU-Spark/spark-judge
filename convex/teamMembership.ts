import { QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

export function isProjectMember(
  team: { submittedBy?: string; entrantEmails?: string[] },
  userId: string,
  email?: string | null,
) {
  if (team.submittedBy === userId) return true;
  const normalized = email?.trim().toLowerCase();
  return Boolean(normalized && team.entrantEmails?.some(
    (entrant) => entrant.trim().toLowerCase() === normalized,
  ));
}

/**
 * Returns a predicate that is true for teams the user belongs to, by
 * submission or listed entrant email. Judges may not join for, assign, or
 * score these. Free-text member names are not checked; organizers see those
 * through `findPossibleConflicts`.
 */
export async function getOwnTeamPredicate(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<(team: Pick<Doc<"teams">, "submittedBy" | "entrantEmails">) => boolean> {
  const user = await ctx.db.get(userId);
  return (team) => isProjectMember(team, userId, user?.email);
}
