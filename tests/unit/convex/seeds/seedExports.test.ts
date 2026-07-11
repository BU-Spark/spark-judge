import { describe, expect, it } from 'vitest';
import * as seed from '../../../../convex/seed';

describe('seed module exports', () => {
  it('keeps bootstrap handlers internal rather than public mutations', () => {
    expect(Object.keys(seed).sort()).toEqual([
      'clearAllData',
      'makeCurrentUserAdminForAllEvents',
      'makeUserAdminByEmail',
      'seedCohortJudgingDemo',
      'seedDemoDayEvent',
      'seedEvents',
      'seedEverything',
      'seedJudgeScores',
      'seedPrizeJudgingFlowCohortsDemo',
      'seedPrizeJudgingFlowDemo',
      'seedPrizeJudgingFlowLockedDemo',
      'seedRegularJudgingDemo',
      'seedCodeAndTellDemo',
    ].sort());
  });

  it('does not expose a self-admin debug mutation', () => {
    expect('debugMakeMeAdmin' in seed).toBe(false);
  });

  it('marks destructive/bootstrap entries as internal Convex functions', () => {
    for (const name of [
      'clearAllData',
      'makeCurrentUserAdminForAllEvents',
      'makeUserAdminByEmail',
      'seedEvents',
      'seedEverything',
    ] as const) {
      expect((seed[name] as any).isInternal).toBe(true);
      expect((seed[name] as any).isPublic).not.toBe(true);
    }
  });
});
