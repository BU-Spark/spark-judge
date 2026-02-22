import { describe, expect, it } from 'vitest';
import type { Id } from '../../../../convex/_generated/dataModel';
import {
  isInvalidSeedAuthId,
  normalizeAuthenticatedUserId,
} from '../../../../convex/seeds/shared/auth';
import {
  clampSeedScore,
  computeSeedTotalScore,
  slugifySeedValue,
} from '../../../../convex/seeds/shared/scoring';

describe('seed shared helpers', () => {
  describe('auth helpers', () => {
    it('flags dashboard fake IDs as invalid', () => {
      expect(isInvalidSeedAuthId('fake_id')).toBe(true);
      expect(isInvalidSeedAuthId('fake_123')).toBe(true);
      expect(isInvalidSeedAuthId('real_user_123')).toBe(false);
      expect(isInvalidSeedAuthId(null)).toBe(false);
      expect(isInvalidSeedAuthId(undefined)).toBe(false);
    });

    it('normalizes invalid auth IDs to null', () => {
      const fakeId = 'fake_abc' as Id<'users'>;
      const realId = 'user_abc' as Id<'users'>;

      expect(normalizeAuthenticatedUserId(fakeId)).toBeNull();
      expect(normalizeAuthenticatedUserId(realId)).toBe(realId);
      expect(normalizeAuthenticatedUserId(null)).toBeNull();
    });
  });

  describe('scoring helpers', () => {
    it('slugifies values for deterministic IDs and URLs', () => {
      expect(slugifySeedValue('Sponsor Choice - Nebula Ventures')).toBe(
        'sponsor-choice-nebula-ventures'
      );
      expect(slugifySeedValue('  AI/ML Team  ')).toBe('ai-ml-team');
    });

    it('clamps and rounds scores into 1-5 range', () => {
      expect(clampSeedScore(0.2)).toBe(1);
      expect(clampSeedScore(2.49)).toBe(2);
      expect(clampSeedScore(3.5)).toBe(4);
      expect(clampSeedScore(7.8)).toBe(5);
    });

    it('computes weighted totals while ignoring opted-out/null scores', () => {
      const total = computeSeedTotalScore(
        [
          { category: 'Innovation', score: 4 },
          { category: 'Technical', score: 3 },
          { category: 'Presentation', score: null, optedOut: true },
        ],
        [
          { name: 'Innovation', weight: 2 },
          { name: 'Technical', weight: 1 },
          { name: 'Presentation', weight: 1 },
        ]
      );

      // ((4*2 + 3*1) / (2+1)) * (2+1+1)
      expect(total).toBeCloseTo(14.6667, 3);
    });

    it('returns 0 when no usable category scores exist', () => {
      const total = computeSeedTotalScore(
        [
          { category: 'Innovation', score: null, optedOut: true },
          { category: 'Technical', score: null, optedOut: true },
        ],
        [
          { name: 'Innovation', weight: 2 },
          { name: 'Technical', weight: 1 },
        ]
      );

      expect(total).toBe(0);
    });
  });
});
