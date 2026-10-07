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
