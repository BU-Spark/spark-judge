import { describe, expect, it } from 'vitest';
import { profileParticipation } from '../../../src/lib/profileParticipation';

describe('profileParticipation', () => {
  it('counts and displays scoring activity even when the event is scheduled as upcoming', () => {
    const scoredEvent = { teamsJudged: 9 };
    const result = profileParticipation({
      activeEvents: [], pastEvents: [],
      upcomingEvents: [scoredEvent, { teamsJudged: 0 }],
    });
    expect(result.historyEvents).toEqual([scoredEvent]);
    expect(result.totalEvents).toBe(1);
    expect(result.totalTeamsScored).toBe(9);
  });

  it('excludes untouched assignments and totals only displayed participation', () => {
    const result = profileParticipation({
      activeEvents: [{ teamsJudged: 2 }, { teamsJudged: 0 }],
      pastEvents: [{ teamsJudged: 3 }, { teamsJudged: 0 }],
      upcomingEvents: [{ teamsJudged: 0 }],
    });
    expect(result.activeEvents).toHaveLength(1);
    expect(result.historyEvents).toHaveLength(1);
    expect(result.totalEvents).toBe(2);
    expect(result.totalTeamsScored).toBe(5);
  });
});
