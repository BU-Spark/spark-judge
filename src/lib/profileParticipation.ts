// A schedule alone is not evidence of participation. Keep scored events even
// when their dates or phase still classify them as upcoming.
export function profileParticipation<T extends { teamsJudged: number }>(profile: {
  activeEvents: T[];
  pastEvents: T[];
  upcomingEvents: T[];
}) {
  const activeEvents = profile.activeEvents.filter((entry) => entry.teamsJudged > 0);
  const historyEvents = [...profile.pastEvents, ...profile.upcomingEvents]
    .filter((entry) => entry.teamsJudged > 0);
  const attendedEvents = [...activeEvents, ...historyEvents];
  return {
    activeEvents,
    historyEvents,
    totalEvents: attendedEvents.length,
    totalTeamsScored: attendedEvents.reduce((total, entry) => total + entry.teamsJudged, 0),
  };
}
