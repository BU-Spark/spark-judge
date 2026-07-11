import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isAdmin,
  escapeCsvCell,
  getJudgeCodeFailureState,
  JUDGE_CODE_LOCKOUT_MS,
  JUDGE_CODE_MAX_FAILED_ATTEMPTS,
  isJudgeVerifiedForEvent,
  isJudgeCodeLocked,
  requireAuth,
  requireAdmin,
  shapeEventForViewer,
  stripJudgeCode,
  shouldInvalidateJudgeCodeState,
} from '../../../convex/helpers';
import { Id } from '../../../convex/_generated/dataModel';

// Mock the auth module
vi.mock('@convex-dev/auth/server', () => ({
  getAuthUserId: vi.fn(),
}));

describe('helpers', () => {
  const mockCtx = {
    db: {
      get: vi.fn(),
    },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isAdmin', () => {
    it('should return false when user is not authenticated', async () => {
      const { getAuthUserId } = await import('@convex-dev/auth/server');
      vi.mocked(getAuthUserId).mockResolvedValue(null);

      const result = await isAdmin(mockCtx);
      expect(result).toBe(false);
    });

    it('should return false when user does not exist', async () => {
      const { getAuthUserId } = await import('@convex-dev/auth/server');
      const userId = 'user123' as Id<'users'>;
      vi.mocked(getAuthUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue(null);

      const result = await isAdmin(mockCtx);
      expect(result).toBe(false);
    });

    it('should return false when user is not admin', async () => {
      const { getAuthUserId } = await import('@convex-dev/auth/server');
      const userId = 'user123' as Id<'users'>;
      vi.mocked(getAuthUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({ _id: userId, isAdmin: false });

      const result = await isAdmin(mockCtx);
      expect(result).toBe(false);
    });

    it('should return true when user is admin', async () => {
      const { getAuthUserId } = await import('@convex-dev/auth/server');
      const userId = 'user123' as Id<'users'>;
      vi.mocked(getAuthUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({ _id: userId, isAdmin: true });

      const result = await isAdmin(mockCtx);
      expect(result).toBe(true);
    });
  });

  describe('requireAuth', () => {
    it('should throw error when user is not authenticated', async () => {
      const { getAuthUserId } = await import('@convex-dev/auth/server');
      vi.mocked(getAuthUserId).mockResolvedValue(null);

      await expect(requireAuth(mockCtx)).rejects.toThrow('Not authenticated');
    });

    it('should return userId when user is authenticated', async () => {
      const { getAuthUserId } = await import('@convex-dev/auth/server');
      const userId = 'user123' as Id<'users'>;
      vi.mocked(getAuthUserId).mockResolvedValue(userId);

      const result = await requireAuth(mockCtx);
      expect(result).toBe(userId);
    });
  });

  describe('judge code verification', () => {
    it('denies scoring and assignment access to an unverified judge', () => {
      const event = { judgeCode: 'SECRET' };
      const judge = {};

      expect(isJudgeVerifiedForEvent(event, judge)).toBe(false);
    });

    it('allows both scoring and assignment access after persisted verification', () => {
      const event = { judgeCode: 'SECRET' };
      const judge = { judgeCodeVerifiedAt: Date.now() };

      expect(isJudgeVerifiedForEvent(event, judge)).toBe(true);
    });

    it('preserves self-registration for events without a judge code', () => {
      expect(isJudgeVerifiedForEvent({}, {})).toBe(true);
    });

    it('locks after the bounded number of failed attempts', () => {
      const now = 1_000_000;
      let judge: { judgeCodeFailedAttempts?: number; judgeCodeLockedUntil?: number } = {};
      for (let attempt = 0; attempt < JUDGE_CODE_MAX_FAILED_ATTEMPTS; attempt += 1) {
        judge = { ...judge, ...getJudgeCodeFailureState(judge, now) };
      }
      expect(judge.judgeCodeFailedAttempts).toBe(JUDGE_CODE_MAX_FAILED_ATTEMPTS);
      expect(judge.judgeCodeLockedUntil).toBe(now + JUDGE_CODE_LOCKOUT_MS);
      expect(isJudgeCodeLocked(judge, now + 1)).toBe(true);
    });

    it('starts a new failure window after lockout expiry', () => {
      const now = 2_000_000;
      const state = getJudgeCodeFailureState(
        {
          judgeCodeFailedAttempts: JUDGE_CODE_MAX_FAILED_ATTEMPTS,
          judgeCodeLockedUntil: now - 1,
        },
        now,
      );
      expect(state).toEqual({
        judgeCodeFailedAttempts: 1,
        judgeCodeLockedUntil: undefined,
      });
    });

    it('keeps a verified judge verified while the current code remains unchanged', () => {
      expect(
        isJudgeVerifiedForEvent(
          { judgeCode: 'CURRENT' },
          { judgeCodeVerifiedAt: 1_000 },
        ),
      ).toBe(true);
      expect(shouldInvalidateJudgeCodeState('CURRENT', 'ROTATED')).toBe(true);
      expect(shouldInvalidateJudgeCodeState('CURRENT', 'CURRENT')).toBe(false);
    });

    it('strips the judge code from public event data', () => {
      expect(stripJudgeCode({ name: 'Event', judgeCode: 'SECRET' })).toEqual({
        name: 'Event',
      });
    });
  });

  describe('requireAdmin', () => {
    it('should throw error when user is not authenticated', async () => {
      const { getAuthUserId } = await import('@convex-dev/auth/server');
      vi.mocked(getAuthUserId).mockResolvedValue(null);

      await expect(requireAdmin(mockCtx)).rejects.toThrow('Not authenticated');
    });

    it('should throw error when user is not admin', async () => {
      const { getAuthUserId } = await import('@convex-dev/auth/server');
      const userId = 'user123' as Id<'users'>;
      vi.mocked(getAuthUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({ _id: userId, isAdmin: false });

      await expect(requireAdmin(mockCtx)).rejects.toThrow(
        'Not authorized - admin access required'
      );
    });

    it('should return userId when user is admin', async () => {
      const { getAuthUserId } = await import('@convex-dev/auth/server');
      const userId = 'user123' as Id<'users'>;
      vi.mocked(getAuthUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({ _id: userId, isAdmin: true });

      const result = await requireAdmin(mockCtx);
      expect(result).toBe(userId);
    });

    it('should throw error when user does not have isAdmin field', async () => {
      const { getAuthUserId } = await import('@convex-dev/auth/server');
      const userId = 'user123' as Id<'users'>;
      vi.mocked(getAuthUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({ _id: userId });

      await expect(requireAdmin(mockCtx)).rejects.toThrow(
        'Not authorized - admin access required'
      );
    });
  });

  describe('public event shaping', () => {
    const team = {
      _id: 'team-1',
      eventId: 'event-1',
      name: 'Visible team',
      description: 'Project',
      members: ['A'],
      hidden: false,
      entrantEmails: ['entrant@example.com'],
      submittedBy: 'user-1',
      airtableProjectRecordId: 'rec123',
      rawScore: 99,
    };

    it('omits secrets, hidden teams, winners, and internal team fields publicly', () => {
      const result = shapeEventForViewer(
        {
          _id: 'event-1',
          name: 'Event',
          judgeCode: 'SECRET',
          resultsReleased: false,
          overallWinner: 'team-1',
          categoryWinners: { Innovation: 'team-1' },
        },
        [team, { ...team, _id: 'hidden', hidden: true }],
        false,
      );

      expect(result).not.toHaveProperty('judgeCode');
      expect(result).not.toHaveProperty('overallWinner');
      expect(result).not.toHaveProperty('categoryWinners');
      expect(result.teams).toHaveLength(1);
      expect(result.teams[0]).not.toHaveProperty('entrantEmails');
      expect(result.teams[0]).not.toHaveProperty('submittedBy');
      expect(result.teams[0]).not.toHaveProperty('airtableProjectRecordId');
    });

    it('preserves the current judge code and full event data for admins', () => {
      const result = shapeEventForViewer(
        { _id: 'event-1', judgeCode: 'SECRET', resultsReleased: false },
        [team],
        true,
      );

      expect(result.judgeCode).toBe('SECRET');
      expect(result.teams).toEqual([team]);
    });
  });

  describe('CSV safety', () => {
    it.each(['=1+1', ' +1+1', '\t-1+1', '  @cmd'])(
      'neutralizes formula prefixes in %j',
      (value) => {
        expect(escapeCsvCell(value)).toBe(`"'${value}"`);
      },
    );

    it('escapes quotes while preserving CSV cell boundaries', () => {
      expect(escapeCsvCell('Team "A"')).toBe('"Team ""A"""');
    });
  });
});
