import { QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

/**
 * Admins add teams on entrants' behalf (for example from a Devpost export),
 * so for them being the submitter is not membership; a listed entrant email
 * still is. Pass `isAdmin` so organizers who also judge are not blocked.
 */
export function isProjectMember(
  team: { submittedBy?: string; entrantEmails?: string[] },
  userId: string,
  email?: string | null,
  isAdmin = false,
) {
  if (!isAdmin && team.submittedBy === userId) return true;
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
  return (team) =>
    isProjectMember(team, userId, user?.email, user?.isAdmin === true);
}
