import { describe, expect, it } from 'vitest';
import * as seed from '../../../../convex/seed';

describe('seed module exports', () => {
  it('keeps the same public seed mutation names', () => {
    const exportNames = Object.keys(seed).sort();

    expect(exportNames).toEqual(
      [
        'clearAllData',
        'makeCurrentUserAdminForAllEvents',
        'makeUserAdminByEmail',
        'seedCohortJudgingDemo',
        'seedDemoDayEvent',
        'seedEvents',
        'seedEverything',
        'seedJudgeScores',
        'seedPrizeJudgingFlowDemo',
        'seedPrizeJudgingFlowLockedDemo',
        'seedRegularJudgingDemo',
      ].sort()
    );
  });

  it('exports defined mutation references for every seed entry', () => {
    expect(seed.seedEvents).toBeDefined();
    expect(seed.seedJudgeScores).toBeDefined();
    expect(seed.clearAllData).toBeDefined();
    expect(seed.makeCurrentUserAdminForAllEvents).toBeDefined();
    expect(seed.makeUserAdminByEmail).toBeDefined();
    expect(seed.seedEverything).toBeDefined();
    expect(seed.seedDemoDayEvent).toBeDefined();
    expect(seed.seedCohortJudgingDemo).toBeDefined();
    expect(seed.seedRegularJudgingDemo).toBeDefined();
    expect(seed.seedPrizeJudgingFlowDemo).toBeDefined();
    expect(seed.seedPrizeJudgingFlowLockedDemo).toBeDefined();
  });
});
